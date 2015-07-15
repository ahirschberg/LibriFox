// helpful for debugging asyncStorage, 
// a callback that prints its arguments
var debug_print_cbk = function () { console.log(arguments); },
    fm_page = function () {$.mobile.changePage('filemanager.html')};

// disables firefox taphold popup menu in firefox os 2.2+
window.oncontextmenu = function(event) {
     event.preventDefault();
     event.stopPropagation();
     return false;
};

var bookCache = {};
var httpRequestHandler = new HttpRequestHandler();

function stripHTMLTags(str) {
    return str.replace(/<(?:.|\n)*?>/gm, '');
}

function Book(args) {
    this.chapters = args.chapters;

    var json = args.json;
    this.description = stripHTMLTags(json.description);
    this.title = stripHTMLTags(json.title);
    this.id = parseInt(json.id);
}

function Chapter(args) {
    var name_regex = /^<!\[CDATA\[(.*)\]\]>$/;
    var name_match = name_regex.exec(args.name);
    this.name = stripHTMLTags((name_match && name_match[1]) || args.name); // if regex doesn't match, fall back to raw string
    this.index = args.index;
    this.url = args.url;
}
Chapter.parseFromXML = function (xml_string) {
    var xml = $(xml_string),
        $items = xml.find("item"),
        chapters = [];

    $items.each(function (index, element) {
        var $title = $(element).find("title");
        var $enclosure = $(element).find("enclosure");
        var chapter = new Chapter({
            'index': chapters.length,
            'name': $title.text(),
            'url': $enclosure.attr('url')
        });
        chapters.push(chapter);
    });
    
    return chapters;
};

function UIState(args) {
    this.currentBook = args.currentBook;
    this.currentChapter = args.currentChapter;
    this.bookCache = args.bookCache; // to increase reausability of object - did not hard-code the coupling with our global bookCache

    this.setCurrentBookById = function (id) {
        this.currentBook = this.bookCache[id];
    };
    this.setCurrentChapterByIndex = function (index) {
        this.currentChapter = this.currentBook.chapters[index];
    };
}
var appUIState = new UIState({
    'bookCache': bookCache
});

function ChaptersListPageGenerator(args) {
    var that = this,
        httpRequestHandler = args.httpRequestHandler,
        selectors = args.selectors,
        bookDownloadManager = args.bookDownloadManager,
        bookReferenceManager = args.bookReferenceManager,
        storedBookUiState = args.storedBookUiState,
        PROGRESSBAR_HTML =  '<div class="progressBar" style="display: none">' +
                            '<div class="progressBarSlider"></div></div>';

    this.generatePage = function (book) {
        $(selectors.book_title).text(book.title);
        $(selectors.book_description).text(book.description);
        
        if (book.chapters) {
            showLocalChapters(book);
        } else {
            getChaptersFromFeed(book.id, function (chapters) {
                book.chapters = chapters;
                showLocalChapters(book);
            });
        }
        
        showFooterAlert({book_id: book.id});
    };
    
    function showFooterAlert(args) {
        var book_id = args.book_id,
            book_ref = args.book_ref,
            show_footer = function (book_ref) {
                $(selectors.footer_alert)
                    .click(function () {
                        storedBookUiState.book_ref = book_ref;
                    })
                    .show({
                        complete: function () {
                            var footer_height = $(this).height();
                            if (footer_height) {
                                $(selectors.page).css('padding-bottom', footer_height + 'px');
                            }
                        }
                    });
            };
        
        if ($(selectors.footer_alert).css('display') === 'none') {
            if (book_ref) {
                show_footer(book_ref);
            } else {
            bookReferenceManager.loadJSONReference(book_id, function (obj) {
                if (obj) {
                    show_footer(obj);
                }
            });
            }
        } else {
            console.log('showFooterAlert called, but the footer was already showing.  Doing nothing');
        }
    }
    
    this.registerEvents = function () {
        $(document).on("pagecreate", selectors.page, function (event) {
            var selectedBook = appUIState.currentBook;
            if (!selectedBook) { // selectedBook is undefined if you refresh the app from WebIDE on a chapter list page
                console.warn("Chapters List: selectedBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
                return false;
            }
            that.generatePage(selectedBook);
        });
    };

    function showLocalChapters(book) {
        // Removed until there is a solution for the async storage problem
        var $dl_all = $('<li/>', {
            html: $('<a/>', {
                text: 'Download all chapters (WIP)'
            }),
            click: function () {
                var that = this;
                $(that).unbind('click');
                
                book.chapters.forEach(function (chapter) {
                        var chapter_list_element = $('[chapter-index="' + chapter.index + '"]');
                        downloadChapterWithCbk(book, chapter, chapter_list_element);
                });
            }
        }).attr('data-icon', 'arrow-d');
        $dl_all.append(PROGRESSBAR_HTML);
        
        $(selectors.list).append($dl_all);
        $.each(book.chapters, function (index, chapter) {
            generateChapterListItem(book, chapter, this);
        });
        $(selectors.list).listview('refresh');
    };

    function generateChapterListItem(book, chapter) {
        var $chapterListItem = $('<li/>')
            .addClass('chapter-listing')
            .attr('chapter-index', chapter.index)
            .html(
                $('<a/>')
                    .append($('<h2/>', {text: chapter.name}))
                    .append(PROGRESSBAR_HTML)
                )
            .attr('data-icon', 'arrow-d');
            
        $chapterListItem.click(function () {
            downloadChapterWithCbk(book, chapter, this);
        });
        $(selectors.list).append($chapterListItem);
    }
    
    function downloadChapterWithCbk(book, chapter, that) {
        $(that).unbind('click');
        return bookDownloadManager.downloadChapter(
            book,
            chapter,
            function (event) {
                if (event.lengthComputable) {
                    var percentage = (event.loaded / event.total) * 100;
                    $(that).find('.progressBar').show();
                    $(that).find('.progressBarSlider').css('width', percentage + '%');
                }
            },
            function (book_ref) {
                showFooterAlert({book_ref: book_ref});
            });
    }

    function getChaptersFromFeed(book_id, callback_func) {
        httpRequestHandler.getXML("https://librivox.org/rss/" + encodeURIComponent(book_id), function (xhr) {
            var xml = $(xhr.response)
            chapters = Chapter.parseFromXML(xml);
            callback_func(chapters);
        });
    };
}

function BookDownloadManager(args) {
    var that = this,
        httpRequestHandler = args.httpRequestHandler,
        storageManager = args.storageManager,
        fileManager = args.fileManager;
    
    function downloadFile(url, finished_callback, progress_callback) {
        var req_progress_callback;
        var additional_args = {};

        if (progress_callback) {
            additional_args.progress_callback = function () {
                progress_callback.apply(this, arguments)
            };
        }
        
        httpRequestHandler.getBlob(
            url,
            function (xhr) {
                finished_callback(xhr.response);
            },
            additional_args);
    }

    this.downloadChapter = function (book_obj, chapter_obj, progress_callback, finished_callback) {
        // assumes that #writeChapter will always write following this pattern, which could cause problems
        var filepath = storageManager.getChapterFilePath(book_obj.id, chapter_obj.index);
        fileManager.tryWriteFile(
            filepath,
            function (writeable, request) {
                if (writeable) {
                    downloadFile(
                        chapter_obj.url,
                        function (response) {
                            storageManager.writeChapter(response, book_obj, chapter_obj, finished_callback);
                        },
                        progress_callback
                    );
                } else {
                    console.warn('tried and failed to write to path ' + filepath + ' with error',
                                 request.error);
                    alert('Error: could not write to file. ' + request.error.name);
                }
            }
        );
    }
}

var lf_getDeviceStorage = function (storage_str) {
    return navigator.getDeviceStorage && navigator.getDeviceStorage(storage_str || 'sdcard');
}

function BookStorageManager(args) {
    var that = this,
        deviceStoragesManager = args.deviceStoragesManager,
        referenceManager = args.referenceManager;

    this.writeChapter = function (blob, book_obj, chapter_obj, func_done) {
        var chPath = that.getChapterFilePath(book_obj.id, chapter_obj.index);
        that.write(blob, chPath, function (saved_path) {
            referenceManager.storeJSONReference(book_obj, chapter_obj, saved_path, {
                reference_created: func_done
            });
        });
    };

    this.write = function (blob, path, success_fn) {
        console.log('writing:', blob, path);
        var request = deviceStoragesManager.getDownloadsDevice().addFile(blob, path);
        if (request) {
            request.onsuccess = function () {
                console.log('wrote: ' + this.result);
                success_fn && success_fn(this.result);
            };
            request.onerror = function () {
                console.warn('failed to write ' + path + ': ', this.error);
                alert('failed to write file: ' + this.error.name);
            }
        }
    };
    
    this.delete = function (path, success_fn, error_fn) {
        var request = deviceStoragesManager.getSDCard().delete(path);
        request.onsuccess = function () {
            console.log("File deleted: " + path);
            success_fn && success_fn();
        };
        request.onerror = function () {
            console.log("Unable to delete the file at " + path, this.error);
            error_fn && error_fn(this.error);
        };
    };

    this.getChapterFilePath = function (book_id, chapter_index) {
        return 'librifox/' + book_id + '/' + chapter_index + '.lfa';
    };
}

function BookReferenceManager(args) {
    var args = args || {},
        async_storage = args.asyncStorage,
        storageManager,
        obj_storage = {},
        that = this,
        JSON_PREFIX = this.JSON_PREFIX = 'bookid_',
        current_jobs = {};
    
    this.obj_storage = obj_storage; // for testing

    function strip_functions(obj) {
        var cloned_obj = jQuery.extend(true, {}, obj);
        console.log('stripping functions from', cloned_obj);
        Object.keys(obj).forEach(function (key) {
            if (typeof obj[key] === 'function') {
                delete obj[key]
            }
        })
        console.log('is now ', obj)
        return obj;
    }
    
    function store_in_async (book_id, obj) {
        console.log('store_in_async called.')
        var obj_to_store = strip_functions(obj);
        async_storage.setItem(JSON_PREFIX + book_id, obj_to_store, function (transaction) {
            console.log('wrote to asyncStorage:', obj_to_store);
            var job = current_jobs[book_id];
            console.log('job.when_done is', job.when_done)
            var _when_done = job.when_done;
            job.when_done = undefined;
            _when_done && _when_done();
            job.status = 'DONE';
            console.log('DONE! job store is now ' + JSON.stringify(current_jobs))
        });
    }
    
    this.storeJSONReference = function (book_obj, chapter_obj, path, options) {
        
        options = options || {}
        if (!isValidIndex(book_obj.id)) {
            throw new Error('book_obj.id is not a valid index: ' + book_obj.id);
        }
        that.loadJSONReference(book_obj.id, function (obj) {
            console.log('loadJSONReference callback evaluated');
            var obj = obj || {};
            obj.title = obj.title || book_obj.title;
            obj.id    = obj.id    || book_obj.id;

            if (!isValidIndex(chapter_obj.index)) {
                throw new Error('chapter_obj.index is not a valid index: ' + chapter_obj.index);
            }
            obj[chapter_obj.index] = {
                path: path,
                name: chapter_obj.name
            };
            
            var curr_job = current_jobs[book_obj.id];
            if (curr_job && curr_job.status === 'WORKING') {
                console.log('currently job store is busy: ' + JSON.stringify(current_jobs) + ' so when_done is being set.' );
                curr_job.when_done = function () {
                    console.log('when_done called for job store ' + JSON.stringify(current_jobs) + ' and chapter ', chapter_obj);
                    store_in_async(book_obj.id, obj);
                };
            } else {
                console.log('No current task for job store ' + JSON.stringify(current_jobs) + ', storing obj')
                current_jobs[book_obj.id] = {
                    status: 'WORKING', 
                    when_done: undefined
                };
                store_in_async(book_obj.id, obj);
            }
            
            applyHelperFunctions(obj);
            obj_storage[JSON_PREFIX + book_obj.id] = obj;
            
            options.reference_created && options.reference_created(obj);
        });
    };

    this.loadJSONReference = function (book_id, load_callback, prefix) {
        if (!prefix && prefix !== '') { // allow null prefix, but default to JSON_PREFIX. this is bad behavior :(
            prefix = JSON_PREFIX;
        }
        var os_book_ref = obj_storage[prefix + book_id];
        if (os_book_ref) {
            load_callback(os_book_ref);
        } else {
            async_storage.getItem( (prefix + book_id), function (obj) {
                console.log('from storage:', obj);
                console.log('from obj:', obj_storage[prefix + book_id]);
                if (obj_storage[prefix + book_id]) { // if the object has loaded since the async was called
                    console.log('object was added to object_storage after async getItem called');
                    load_callback(obj_storage[prefix + book_id]);
                } else {
                    applyHelperFunctions(obj);
                    obj_storage[prefix + book_id] = obj;
                    load_callback(obj);
                }
            });
        }
    };

    this.eachReference = function (each_fn) {
        async_storage.length(function(length) {
            var i;
            for (i = 0; i < length; i++) {
                async_storage.key(i, function(key) {
                    if (key.startsWith(JSON_PREFIX)) {
                        that.loadJSONReference(key, function (book_ref) {
                            each_fn(book_ref);
                        }, '');
                    }
                });
            }
        });
    };
    
    this.everyChapter = function (each_ch_fn) {
        that.eachReference(function (book_ref) {
            book_ref.eachChapter(function (chapter, index) {
                each_ch_fn(chapter, book_ref, index);
            });
        });
    }
    
    this.registerStorageManager = function (_storageManager) {
        storageManager = _storageManager;
    };

    function applyHelperFunctions(book_ref) {
        if (!book_ref) {
            return undefined;
        }
        book_ref.eachChapter = function (each_fn) {
            Object.keys(book_ref).forEach(function (key) {
                if (isValidIndex(key) && book_ref.hasOwnProperty(key)) {
                    each_fn(book_ref[key], parseInt(key, 10));
                }
            });
        };
        book_ref.numChapters = function () {
            var length = 0;
            this.eachChapter(function () {
                length += 1;
            });
            return length;
        }

        var remove_book_from_references = function (id) {
            console.log('Completely removing book with id ' + id);
            delete obj_storage[JSON_PREFIX + id];
            async_storage.removeItem(JSON_PREFIX + id);

        };
        book_ref.deleteChapter = function (index, success_fn) {
            var this_book_ref = this;
            storageManager.delete(
                this_book_ref[index].path,
                function () {
                    delete this_book_ref[index];
                    var key = JSON_PREFIX + this_book_ref.id;
                    if (this_book_ref.numChapters() === 0) {
                        remove_book_from_references(this_book_ref.id);
                    } else {
                        obj_storage[key] = this_book_ref;
                        async_storage.setItem(key, this_book_ref);
                    }
                    success_fn && success_fn();

                },
                function (err) {
                    alert('Error deleting chapter with index ' + index + '. ' + err.name)
                });
        };


        // TURN BACK, ALL YE WHO ENTER HERE
        book_ref.deleteBook = function (success_fn, error_fn) {
            var this_book_ref = this,
                errors = false,
                num_chapters = this_book_ref.numChapters();

            // oh my this is horrible, forced to do this because of FXOS filesystem
            // error possibility on the 2.0 browser (seems fixed on 2.2)
            var chapters_attempted_removal = 0,
                finalize_deletions_if_ready = function () {
                    chapters_attempted_removal += 1;
                    if (chapters_attempted_removal >= num_chapters) {
                        if (!errors) {
                            // only remove JSON once all chapters have been successfully removed
                            remove_book_from_references(this_book_ref.id);
                            
                            success_fn && success_fn();
                        } else {
                            console.warn('Unable to fully remove book "' + this_book_ref.title + '". Errors were encountered when attempting to delete files.');
                            obj_storage[JSON_PREFIX + this_book_ref.id] = undefined;
                            async_storage.setItem(JSON_PREFIX + this_book_ref.id, this_book_ref);

                            error_fn && error_fn();
                        }
                    }
                };
            if (num_chapters > 0) {
                this_book_ref.eachChapter(function (chapter, index) {
                    storageManager.delete(
                        chapter.path,
                        function () {
                            delete this_book_ref[index];
                            finalize_deletions_if_ready();
                        },
                        function (err) {
                            console.error('Error deleting chapter with index ' + index + '. ' + err.name);
                            errors = true;
                            finalize_deletions_if_ready();
                        }
                    );
                });
            } else {
                finalize_deletions_if_ready();
            }
        };
        return book_ref;
    }

    function isValidIndex(index) {
        return /^\d+$/.test(index)
    }
}

function BookReferenceValidator(args) {
    'use strict';
    
    var fileManager = args.fileManager,
        referenceManager = args.referenceManager;
    
    this.registerEvents = function (storage_device) {
        storage_device.addEventListener("change", function (event) {
            console.log('The file "' + event.path + '" has been ' + event.reason);
        });
    };
    
    this.validateMetadata = function (done_func) {
        var num_chapters = 0,
            num_chapters_checked = 0,
            invalid_paths = [];
        if (done_func) { // don't bother checking length if it won't matter
            referenceManager.everyChapter(function () {
                num_chapters += 1
            });
        }
        referenceManager.everyChapter(function (chapter, ch_book_ref, index) {
            fileManager.testForFile(chapter.path, function (exist) {
                num_chapters_checked += 1;
                var deleteChapter_done_func = undefined;
                if (done_func && num_chapters_checked === num_chapters) {
                    deleteChapter_done_func = function () {
                        done_func(invalid_paths);
                    }
                }

                if (!exist) {
                    invalid_paths.push(chapter.path);
                    console.log('Could not find file at ' + chapter.path + ' removing reference in JSON');
                    ch_book_ref.deleteChapter(index, deleteChapter_done_func);
                } else if (deleteChapter_done_func && invalid_paths.length > 0) {
                    deleteChapter_done_func();
                }
            });
        });
    };
}

function FilesystemBookReferenceManager(args) {
    'use strict';
    
    var fileManager = args.fileManager,
        settings = args.settings,
        each_book_callback,
        books = this.books = (function () {
            var books_store = {};
            return {
                untitled: [],
                getBook: function (book_str) {
                    return books_store[book_str];
                },
                setBook: function (book_str, obj) {
                    books_store[book_str] = obj;
                },
                eachReference: function(func_each) {
                    Object.keys(books_store).forEach(function (key) {
                        func_each(books_store[key], key);
                    });
                    this.untitled.forEach(function () {
                        func_each.apply(this, arguments);
                    });
                },
                store: books_store // temp
            };
        })();

    this.findAllChapters = function (passed_in_func_each) {
        settings.getAsync('user_folder', function (user_audio_folder) {
            if (user_audio_folder) {
                fileManager.enumerateFiles({
                    enumerate_path: user_audio_folder,
                    match: /.*\.lfa/,
                    func_each: function (result) {
                        id3(result, function (err, tags) {
                            var book_result = addBook(tags, result.name);
                            if (book_result.isNew) {
                                if (each_book_callback) {
                                    each_book_callback(book_result.book);
                                }
                            }
                            passed_in_func_each && passed_in_func_each();
                        });
                    }
                });
            }
        });
    };
    
    this.setCallback = function (each_book) {
        books.eachReference(function (book) { // in case books are parsed before callback is set
            each_book(book);
        });
        
        each_book_callback = each_book;
    };
    
    this.eachReference = function (func_each) {
        books.eachReference(func_each);
    };
    
    function addBook(id3_tags, chapterPath) {
        var track_num = parseInt(stripNullCharacter( // dear lord clean this up
            ( id3_tags.v1.track ||
              (id3_tags.v2.track && id3_tags.v2.track.match(/(\d+)\/\d+/)[1]) || // If the string is in format track#/total#, parse out track#
              id3_tags.v2.track ) ),
            10),
            book_name = stripNullCharacter(id3_tags.album),
            chapter_name = stripNullCharacter(id3_tags.title),
            obj = books.getBook(book_name),
            isNew = false;

        if (!obj) {
            obj = {};
            isNew = true;
        }
        
        var chapters = obj.chapters || {},
            ch_obj = {
                path: chapterPath,
                name: chapter_name || getNameFromPath(chapterPath)
            };
        
        var unindexed = chapters.unindexed || [];
        if (track_num) {
            chapters[track_num] = ch_obj;
        } else {
            unindexed.push(ch_obj);
        }
        chapters.unindexed = unindexed;

        obj.chapters = chapters;
        obj.title = book_name;
        applyHelperFunctions(obj);
        
        if (book_name) {
            books.setBook(book_name, obj);
        } else {
            console.warn('Could not get book name for file at ' + chapterPath);
            obj.title = 'Untitled Book';
            books.untitled.push(obj);
        }
        
        return {book: obj, isNew: isNew};
    }
    
    function applyHelperFunctions (book_ref) {
        book_ref.eachChapter = function (each_fn) { // function duplicated from BookReferenceManager! needs fix!
            Object.keys(book_ref.chapters).forEach(function (key) {
                if (isValidIndex(key) && book_ref.chapters.hasOwnProperty(key)) {
                    each_fn(book_ref.chapters[key], parseInt(key, 10));
                }
            });
            book_ref.chapters.unindexed.forEach(function(chapter) {
                each_fn(chapter);
            });
        };
        
        return book_ref;
    }
    
    function stripNullCharacter(str) {
        if (str && str.replace) {
            return str.replace(/\u0000/g, ''); // some of the ID3 tags have null character, strip those out
        } else {
            return str;
        }
    }
    function getNameFromPath(path_str) {
        var match = path_str.match(/.*\/(.*)$/);
        return match && match[1];
    }
    function isValidIndex(index) { // also duplicated! needs fix!
        return /^\d+$/.test(index)
    }
}

function StoredBooksPageGenerator(args) {
    var that = this,
        referenceManager = args.bookReferenceManager,
        fsReferenceManager = args.fsBookReferenceManager,
        selectors,
        ui_state = args.ui_state;

    this.registerEvents = function (_selectors) {
        selectors = _selectors;
        if (!selectors.page) {
            console.warn('Selectors.page is falsy (undefined?), this causes the page event to be registered for all pages');
        }
        $(document).on('pageshow', selectors.page, function () {
            console.log('pageshow called for ' + selectors.page);
            that.refreshList();
        });
        $(document).on('pagecreate', selectors.page, function () {
            $(selectors.book_actions_popup).bind({
                popupafterclose: function (event, ui) {
                    $(selectors.book_actions_popup + ' .delete_book').unbind('click');
                }
            });
        });
    };
    
    this.refreshList = function () {
        if (!selectors) {
            console.warn('StoredBookPageGenerator: refreshList probably won\'t do anything: selectors is undefined');
        }
        var $list = $(selectors.list);
        $list.children('li.stored-book').remove();
        referenceManager.eachReference(function (obj) {
            createListItem(obj).bind('taphold', function () {
                var that = this;
                $(selectors.book_actions_popup).popup('open', {
                    transition: 'pop',
                    positionTo: that // neat, positions over the held element!
                });
                $(selectors.book_actions_popup + ' .delete_book').click(function () {
                    obj.deleteBook(function () {
                            $(that).remove();
                            $list.listview('refresh');
                        },
                        function () {
                            alert('Not all the chapters could be deleted, likely a Firefox OS filesystem issue. Retry after restarting your device.');
                        });
                    $(selectors.book_actions_popup).popup('close');
                });
            }).appendTo($list);        
            $list.listview('refresh');
        });
        fsReferenceManager.setCallback(function (book_ref) {
            createListItem(book_ref)
                .addClass('filesystem_book')
                .appendTo($list);
            $list.listview('refresh');
        });
    };
    
    function createListItem(book_obj) {
        var link = $('<a/>', {
            'class': 'showFullText',
            text: book_obj.title,
            href: 'stored_chapters.html',
            click: function () {
                ui_state.book_ref = book_obj
            }
        });
        return $('<li/>', {
            'class': 'stored-book',
            html: link
        });
    }
}

function StoredChaptersPageGenerator(args) {
    'use strict';
    
    var that = this,
        ui_state = args.ui_state;

    this.registerEvents = function (selectors) {
        if (!selectors.page) {
            console.warn('Selectors.page is falsy (undefined?), this causes the page event to be registered for all pages');
        }
        $(document).on('pageshow', selectors.page, function () {
            $(selectors.header_title).text(ui_state.book_ref.title);
            var $list = $(selectors.list);
            $list.children('li.stored-chapter').remove();
            ui_state.book_ref.eachChapter(function (chapter_ref, index) {
                createListItem(chapter_ref, index).bind('taphold', function () {
                    var that = this;
                    $(selectors.book_actions_popup).popup('open', {
                        transition: 'pop',
                        positionTo: that // neat, positions over the held element!
                    });
                    $(selectors.book_actions_popup + ' .delete_chapter').click(function () {
                        ui_state.book_ref.deleteChapter(index, function () {
                            $(that).remove();
                            $(selectors.page + ' ul').listview('refresh');
                        })
                        $(selectors.book_actions_popup).popup('close');
                    });
                }).appendTo($list);
            });
            $list.listview('refresh');
        });
        $(document).on('pagecreate', selectors.page, function () {
            $(selectors.book_actions_popup).bind({
                popupafterclose: function (event, ui) {
                    $(selectors.book_actions_popup + ' .delete_chapter').unbind('click');
                }
            });
        });
    };
    
    function createListItem(chapter_ref, chapter_index) {
        var link = $('<a/>', {
            'class': 'showFullText',
            href: 'book.html',
            text: chapter_ref.name,
            click: function () {
                ui_state.chapter_index = chapter_index;
            }
        });
        return $('<li/>', {
            'class': 'stored-chapter',
            html: link
        });
    }
}

function Player(args) {
    var audio_element,
        create_object_url_fn = args.createObjectURL || URL.createObjectURL,
        fileManager = args.fileManager,
        that = this;
    
    this.queueBook = function (obj, index, options) {
        options = options || {};
        audio_element = regenAudioElement();
        
        fileManager.getFileFromPath(
            obj[index].path,
            function (file) {
                audio_element.src = create_object_url_fn(file);
            }, 
            options.load_error
        );
        
        audio_element.addEventListener('loadedmetadata', function () {
            console.log('loaded metadata');
            audio_element.currentTime = options.currentTime || 0;
            options.load_metadata && options.load_metadata(audio_element);
        });
        
        audio_element.addEventListener('loadeddata', function () {
            console.log('loaded data');
            options.load_data && options.load_data(audio_element);
        });
        
        audio_element.addEventListener('ended', function () {
            console.log('ended event fired');
            if (obj.hasOwnProperty(index + 1)) {
                that.queueBook(obj, index + 1);
            }
        });
    }
    
    function regenAudioElement() { // is this necessary?
        delete audio_element;
        audio_element = new Audio();
        return audio_element
    }
    
    this.getAudioElement = function () { // should only be used in tests
        return audio_element;
    }
}

function BookPlayerPageGenerator(args) {
    var ui_state = args.ui_state,
        fileManager = args.fileManager,
        player = args.player
        that = this;

    this.generatePage = function (audio_url, chapter_name) {
        //alert('generated page with audio_url ' + audio_url + ' and chapter_name ' + chapter_name);
        $(args.selectors.audio).prop("src", audio_url);
        $(args.selectors.header).text(chapter_name);
    };

    this.registerEvents = function (selectors) {
        var page = selectors.page;
        $(document).on("pagecreate", selectors.page, function (event) {
            if (!isFinite(ui_state.chapter_index)) {
                console.warn("Chapters List: the chapter reference was undefined, which freezes the app.  Did you refresh from WebIDE?");
                return false;
            }
            /*fileManager.getFileFromPath(
                ui_state.chapter_ref.path, 
                function (file) {
                    var file_url = ui_state.file_url = URL.createObjectURL(file);
                    console.log(file_url);
                    that.generatePage(file_url, ui_state.chapter_ref.name);
                }, function () {
                    alert('Error loading file ' + ui_state.chapter_ref.path + ': ' + this.error.name);
                }
            );*/
            player.queueBook(ui_state.book_ref, ui_state.chapter_index);
            player.getAudioElement().play();
        });
        $(document).on('pagebeforehide', selectors.page, function (event) {
            console.log('pagehide called - revoking url for ' + ui_state.file_url);
            URL.revokeObjectURL(ui_state.file_url);
        });
    };
}

function SettingsManager (args) {
    var settings,
        async_storage = args.asyncStorage,
        st_settings_key = 'lf_settings',
        that = this;
    
    // man async is really ugly
    var loadSettings = (function () {
        var already_loading = false,
            callbacks = [];
        return function (load_callback) {
            if (!settings) { // all callbacks will be executed when settings loads
                callbacks.push(load_callback);
            }
            
            // if a load is not in progress, start one
            // if a load is already in progress, do nothing
            if (!already_loading) { 
                already_loading = true;
                async_storage.getItem(st_settings_key, function (obj) {
                    var obj = obj || generateDefaultSettings();
                    settings = obj;
                    callbacks.forEach(function (cbk, index) {
                        cbk && cbk(obj);
                    });
                });
            } else if (settings) { // if load has completed, execute callback
                console.log('loadSettings was called, but settings was already loaded');
                load_callback(settings);
            }
        };
    })();
    
    loadSettings();
    
    function generateDefaultSettings () {
        return {};
    }
    
    this.set = function (key, value) {
        settings[key] = value;
        console.log('settings object is now', settings);

        async_storage.setItem(st_settings_key, settings);
    };
    this.get = function (key) {
        if (!settings) {
            throw 'Looks like you tried to load settings before ' +
                'they were retrieved. Use getAsync instead!';
        }
        return settings[key];
    };
    
    this.getAsync = function (key, callback) {
        loadSettings(function (settings) {
            console.log('getAsync settings:', settings);
            callback(settings[key]);
        });
    };
}
function SettingsPageGenerator(args) {
    var settings = args.settings,
        deviceStoragesManager = args.deviceStoragesManager;
    
    this.registerEvents = function (selectors) {
        var folder_path_form = selectors.folder_path_form;
        
        if (!selectors.page) {
            console.warn('settings_page selector is falsy! this is probably not what you meant to do.');
        }
        
        $(document).on('pagecreate', selectors.page, function () {
            var input_selector = selectors.page + ' ' + folder_path_form + ' input';
            $(input_selector).val(settings.get('user_folder'));
            $(selectors.page + ' ' + folder_path_form).submit(function () {
                var path = $(input_selector).val();
                console.log('Path was ' + path);
                settings.set('user_folder', path);
                
                return false;
            });
            
            var selected_storage_index = deviceStoragesManager.getDownloadsDeviceIndex();
            deviceStoragesManager.eachDevice(function (storage, index) {
                var $radio = $('<input type="radio" name="radio-choice"/>')
                    .attr('id', 'sdcard-radio-choice-' + index)
                    .click(function () {
                        deviceStoragesManager.setDownloadsDeviceByIndex(index);
                    });
                if (index === selected_storage_index) {
                    $radio.attr('checked', 'checked');
                }
                $radio.appendTo('#sdcard-picker');
                
                $('<label/>')
                    .attr('for', 'sdcard-radio-choice-' + index)
                    .text('sdcard' + index)
                    .appendTo('#sdcard-picker');
                
                $('#sdcard-picker').trigger('create'); // functions as a refresh?
            });
        });
    };
}

function DeviceStoragesManager(args) {
    var settings = args.settings,
        downloads_storage_index = 0,
        nav = args.navigator || navigator;
    
    settings.getAsync('downloads_storage_device_index', function (value) {
        downloads_storage_index = value || 0;
    });
    
    this.setDownloadsDeviceByIndex = function (index) {
        if (isFinite(index) && Math.floor(index) == index) {
            settings.set('downloads_storage_device_index', index);
            downloads_storage_index = index;
        } else {
            console.error('The index ' + index + ' was not valid');
        }
    };
    
    this.getDownloadsDevice = function () { // TODO check performance implications of this / refactor
        return new FileManager(nav.getDeviceStorages('sdcard')[downloads_storage_index]);
    };
    
    this.getDownloadsDeviceIndex = function () {
        return downloads_storage_index;
    };
    
    this.getSDCard = function () {
        return navigator.getDeviceStorage('sdcard');
    }
    
    this.eachDevice = function (func_each) {
        nav.getDeviceStorages('sdcard').forEach(func_each);
    }
}

function FileManager(storage_device) {
    var that = this;

    this.displayAppFiles = function () {
        var times_called = 0;
        var enumeration_cb = function (result) {
            times_called++;
            fileListItem = $('<li>' + result.name + '</li>');
            $("#downloadedFiles").append(fileListItem);
        }
        var done_cb = function () {
            console.log('found ' + times_called + ' files');
            if (times_called < 1) {
                $("#downloadedFiles").append('<li>No files found</li>');
            }
            $("#downloadedFiles").listview('refresh');
        }

        $("#downloadedFiles").empty();
        that.enumerateFiles({
            enumerate_path: 'librifox',
            func_each: enumeration_cb,
            func_done: done_cb,
        });
    }

    this.enumerateFiles = function (args) {
        var match_rxp = args.match,
            enumerate_path = args.enumerate_path || undefined,
            func_each = args.func_each,
            func_done = args.func_done,
            func_error = args.func_error;

        var request = storage_device.enumerate(enumerate_path);
        request.onsuccess = function () {
            if (this.result) {
                var matched_name = this.result.name.match(match_rxp);
                if (matched_name || !match_rxp) {
                    console.log('calling func_each');
                    func_each && func_each(this.result, matched_name);
                }
                this.continue();
            } else {
                console.log('calling func_done');
                func_done && func_done();
            }
        };
        request.onerror = function () {
            console.log(this.error);
            func_error && func_error();
        };
    };
    
    this.testForFile = function (path, result_callback) {
        var request = storage_device.get(path);
        request.onsuccess = function () {
            result_callback(true, this);
        };
        request.onerror = function () {
            result_callback(false, this);
        }
        
    };
    
    this.tryWriteFile = function (path, result_callback) {
        var req = that.addFile(new Blob([''], {'type': 'text/plain'}), path);
        req.onsuccess = function () {
            storage_device.delete(path);
            result_callback(true, this);
        }
        req.onerror = function () {
            result_callback(false, this);
        }
    };

    this.addFile = function (blob, filepath) {
        return storage_device.addNamed(blob, filepath);
    };
    
    this.deleteAllAppFiles = function () {
        var enumeration_cb = function (result) {
            console.log(result.name + ' will be deleted');
            var request = storage_device.delete(result.name);

            request.onsuccess = function () {
                console.log("File deleted");
            }

            request.onerror = function () {
                console.log("Unable to delete the file: " + result.name, this.error);
            }
        }
        that.enumerateFiles({
            match: /librifox\/.*/,
            func_each: enumeration_cb,
            func_done: function () {
                that.displayAppFiles();
            }
        });
    }
    
    this.getFileFromPath = function (path, success, error) {
        var request = storage_device.get(path);
        request.onsuccess = function () {
            var file = this.result;
            console.log('loaded file from ' + file.name);
            success(file)
        };
        request.onerror = function () {
            console.log('Error loading from ' + path, this.error);
            error && error(this);
        };
    }
}

function SearchResultsPageGenerator(args) {
    var httpRequestHandler = args.httpRequestHandler,
        results_selector = args.results_selector,
        field,
        that = this;
    if (!results_selector) {
        console.warn('results_selector is undefined');
    }

    this.registerEvents = function (selectors) {
        $(document).on("pagecreate", selectors.page, function (event) {
            $(selectors.form).submit(function (event) {
                $(results_selector).empty();
                var input = $(selectors.search).val();
                that.displayResults(input);
                return false;
            });
            $(selectors.settings_popup + ' .search-by-title').click(function () {
                field = 'title';
                $(selectors.form + ' input').attr('placeholder', 'Enter a written work');
                $(selectors.settings_popup).popup('close');
            });
            $(selectors.settings_popup + ' .search-by-lname').click(function () {
                field = 'author';
                $(selectors.form + ' input').attr('placeholder', 'Enter an author\'s last name');
                $(selectors.settings_popup).popup('close');
            });
        });
    }

    this.displayResults = function (search_string) {
        $(results_selector).empty();
        getSearchJSON(search_string, function (books) {
            if (books) {
                books.forEach(function (book_entry) {
                    var book = new Book({
                        'json': book_entry
                    });
                    bookCache[book.id] = book;
                    bookListItem = $('<li book-id="' + book.id + '"><a href="chapters.html"><h2>' + book.title + '</h2><p>' + book.description + '</p></a></li>'); //TODO remove injection vulnerability
                    bookListItem.click(function () {
                        appUIState.setCurrentBookById($(this).attr("book-id"));
                    });
                    $(results_selector).append(bookListItem);
                });
                $(results_selector).listview('refresh');
            } else {
                $(results_selector).append(
                    '<p class="noAvailableBooks">' +
                    'No books found when searching for ' + field + ', try simplifying your search.<br/>' +
                    'The LibriVox search API is not very good, so we ' +
                    'apologize for the inconvenience.</p>');
            }
        });
    }

    function getSearchJSON(search_string, callback_func) {
        httpRequestHandler.getJSON(
            generateBookUrl(search_string, field),
            function (xhr) {
                callback_func(xhr.response.books);
            },
            {
                error_callback: function () {
                    alert('Error loading search results.');
                }
            });
    }

    function generateBookUrl(search_string, field) {
        var sanitized_field = field;
        switch(field) { // field is self-contained/private, do I need to test it?
            case 'title':
            case 'author':
            case undefined:
                sanitized_field = field;
                break;
            default:
                console.warn('field ' + field + ' is not valid');
        }
        sanitized_field = sanitized_field || 'title';
        
        return "https://librivox.org/api/feed/audiobooks/" + sanitized_field + "/^" + encodeURIComponent(search_string) + "?&format=json";
    }
}

function HttpRequestHandler() {
    var that = this;

    this.getDataFromUrl = function (url, type, load_callback, other_args) { // NEEDS MORE MAGIC STRINGS
        other_args = other_args || {};
        var xhr = new XMLHttpRequest({
            mozSystem: true
        });

        if (xhr.overrideMimeType && type == 'json') {
            xhr.overrideMimeType('application/json');
        }

        other_args.error_callback = other_args.error_callback || function (e) {
            console.log("error loading " + type + " from url " + url);
            console.log(e);
        }
        other_args.timeout_callback = other_args.timeout_callback || function (e) {
            console.log("timeout loading " + type + " from url " + url);
            console.log(e);
        }

        xhr.addEventListener('load', function (e) {
            load_callback(xhr, e);
        });

        xhr.addEventListener('error', other_args.error_callback);
        xhr.addEventListener('timeout', other_args.timeout_callback);
        xhr.addEventListener('progress', other_args.progress_callback);
        //  xhr.upload.addEventListener("load", transferComplete, false);
        //  xhr.upload.addEventListener("abort", transferCanceled, false);
        xhr.open('GET', url);
        if (type != 'xml') {
            xhr.responseType = type;
        }
        xhr.send();
    }

    this.getJSON = function (url, load_callback, other_args) {
        that.getDataFromUrl(url, 'json', load_callback, other_args);
    };
    this.getXML = function (url, load_callback, other_args) {
        that.getDataFromUrl(url, 'xml', load_callback, other_args);
    };
    this.getBlob = function (url, load_callback, other_args) {
        that.getDataFromUrl(url, 'blob', load_callback, other_args);
    };
}

// Instantiate app if not running in test environment
if (lf_getDeviceStorage()) {
    createApp();
}
var _player;
function createApp () {
    var settings = new SettingsManager({
            asyncStorage: asyncStorage
        }),
        fileManager = new FileManager(lf_getDeviceStorage()),
        player = new Player({fileManager: fileManager}),
        deviceStoragesManager = new DeviceStoragesManager({
            settings: settings    
        }),
        bookReferenceManager = new BookReferenceManager({
            asyncStorage: asyncStorage
        }),
        bookStorageManager = new BookStorageManager({
            deviceStoragesManager: deviceStoragesManager,
            referenceManager: bookReferenceManager
        }),
        bookDownloadManager = new BookDownloadManager({
            httpRequestHandler: httpRequestHandler,
            storageManager: bookStorageManager,
            fileManager: fileManager
        }),
        ui_state = {}, // TODO figure out a sane-er/more elegant way to transfer state
        storedChaptersPageGenerator = new StoredChaptersPageGenerator({
            ui_state: ui_state
        }),
        bookPlayerPageGenerator = new BookPlayerPageGenerator({
            selectors: {
                audio: '#audioSource',
                header: '.book-player-header'
            },
            ui_state: ui_state,
            fileManager: fileManager,
            player: player
        }),
        searchResultsPageGenerator = new SearchResultsPageGenerator({
            httpRequestHandler: httpRequestHandler,
            results_selector: '#results-listing'
        }),
        chaptersListGen = new ChaptersListPageGenerator({
            httpRequestHandler: httpRequestHandler,
            selectors: {
                page: '#chaptersListPage',
                list: '#chaptersList',
                book_title: '.book-title-disp',
                book_description: '.book-desc-disp',
                footer_alert: '#player-shortcut-footer'
            },
            bookDownloadManager: bookDownloadManager,
            bookReferenceManager: bookReferenceManager,
            storedBookUiState: ui_state
        }),
        bookReferenceValidator = new BookReferenceValidator({
            referenceManager: bookReferenceManager,
            fileManager: fileManager
        }),
        fsBookReferenceManager = new FilesystemBookReferenceManager({
            fileManager: fileManager,
            settings: settings
        }),
        storedBooksPageGenerator = new StoredBooksPageGenerator({
            bookReferenceManager: bookReferenceManager,
            fsBookReferenceManager: fsBookReferenceManager,
            ui_state: ui_state
        }),
        settingsPageGenerator = new SettingsPageGenerator({
            settings: settings,
            deviceStoragesManager: deviceStoragesManager
        });

    bookReferenceManager.registerStorageManager(bookStorageManager);
    bookReferenceValidator.registerEvents(lf_getDeviceStorage());
    bookReferenceValidator.validateMetadata(function (invalid_paths) {
        console.log(invalid_paths);
        alert('Warning: the following files were not retrieved ' + invalid_paths.join(', '));
        storedBooksPageGenerator.refreshList();
    });
    fsBookReferenceManager.findAllChapters();
    storedBooksPageGenerator.registerEvents({
        list: '#stored-books-list',
        page: '#storedBooks',
        book_actions_popup: '#bookActionsMenu',
        create_lfa_folder_dialog: '#create_folder_dialog'
    });
    storedChaptersPageGenerator.registerEvents({
        header_title: '.chapter-title',
        list: '#stored-chapters-list',
        page: '#storedChapters',
        book_actions_popup: '#chapterActionsMenu'
    });
    bookPlayerPageGenerator.registerEvents({page: '#book-player'});
    searchResultsPageGenerator.registerEvents({
        page: "#bookSearch",
        form: "#search-form",
        search: "#books-search-bar",
        settings_popup: '#search-settings'
    });
    chaptersListGen.registerEvents();
    settingsPageGenerator.registerEvents({
        page: '#mainSettings',
        folder_path_form: '#user-folder-form'
    });

    $(document).on("pageshow", "#homeFileManager", function () {
        $('#deleteAll').click(function () {
            fileManager.deleteAllAppFiles();
            asyncStorage.clear(); // remove references
        });
        fileManager.displayAppFiles();
    });
    
    _player = player;
}

/*var db = new MediaDB("sdcard", undefined);
db.addEventListener('ready', function () {
    db.enumerate(debug_print_cbk);
});
*/