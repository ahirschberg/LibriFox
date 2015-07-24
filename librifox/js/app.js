// debug stuff, for entering into console
var debug_print_cbk = function () { console.log(arguments); },
    fm_page = function () {$.mobile.changePage('filemanager.html')};

// disables firefox taphold popup menu in firefox os 2.2+
window.oncontextmenu = function(event) {
     event.preventDefault();
     event.stopPropagation();
     return false;
};

var APP_DOWNLOADS_DIR = 'librifox/app_dl';

// some utility methods, should probably be moved into their own classes
function stripHTMLTags(str) {
    return str.replace(/<(?:.|\n)*?>/gm, '');
}
function argumentsToArray (args) {
    return Array.prototype.slice.call(args);
}
function concatSelectors() {
    var args = argumentsToArray(arguments);
    return args.join(' ');
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
// set static function
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

function SearchedBookPageGenerator(args) {
    var that = this,
        httpRequestHandler = args.httpRequestHandler,
        selectors = args.selectors,
        bookDownloadManager = args.bookDownloadManager,
        bookReferenceManager = args.bookReferenceManager,
        chapter_ui_state = {},
        stored_chapters_data_handle = args.stored_chapters_data_handle,
        PROGRESSBAR_HTML =  '<div class="progressBar" style="display: none">' +
                            '<div class="progressBarSlider"></div></div>';

    this.getDataHandle = function () {
        return function (book, chapter) {
            chapter_ui_state.book = book;
            chapter_ui_state.chapter = chapter;
        }
    }
    
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
                        stored_chapters_data_handle(book_ref);
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
                bookReferenceManager.loadBookReference(book_id, function (obj) {
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
            var selectedBook = chapter_ui_state.book;
            if (!selectedBook) { // selectedBook is undefined if you refresh the app from WebIDE on a chapter list page
                console.warn("Chapters List: selectedBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
                return false;
            }
            that.generatePage(selectedBook);
        });
    };

    function showLocalChapters(book) {
        var num_chapters = 0;
        var get_num_chapters = (() => num_chapters);
        var $dl_all = $('<li/>', {
            html: $('<a/>', {
                text: 'Download all chapters'
            }),
            click: function () {
                var that = this;
                if (confirm('You are about to download ' + get_num_chapters() + ' chapters. Data usage may apply. Are you sure?')) {
                    book.chapters.forEach(function (chapter) {
                        var chapter_list_element = $('[chapter-index="' + chapter.index + '"]');
                        downloadChapterWithCbk(book, chapter, chapter_list_element);
                    });
                }
            }
        }).attr('data-icon', 'arrow-d');
        $dl_all.append(PROGRESSBAR_HTML);
        
        $(selectors.list).append($dl_all);
        book.chapters.forEach(function (chapter) {
            generateChapterListItem(book, chapter);
            num_chapters += 1;
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
        var args = {
            book: book,
            chapter: chapter,
            callbacks: {
                progress: function (event) {
                    if (event.lengthComputable) {
                        var percentage = (event.loaded / event.total) * 100;
                        $(that).find('.progressBar').show();
                        $(that).find('.progressBarSlider').css('width', percentage + '%');
                    }
                },
                finished: function (book_ref) {
                    showFooterAlert({
                        book_ref: book_ref
                    });
                },
                error: function () {
                    if (confirm('The file you are trying to download already exists. Delete the old version? ')) {
                        bookDownloadManager.forceDownloadChapter(args) // meta referencing??
                    }
                }
            }
        };
        return bookDownloadManager.downloadChapter(args);
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
    
    this.forceDownloadChapter = function (args) {
         var book_obj = args.book,
             chapter_obj = args.chapter,
             filepath = storageManager.getChapterFilePath(book_obj.id, chapter_obj.index);
        
        return fileManager.deleteFile(filepath).then(() => {
            that.downloadChapter(args);
        }).catch(e => {throw e});
    }

    this.downloadChapter = function (args) {
        var book_obj = args.book,
            chapter_obj = args.chapter,
            progress_callback,
            finished_callback,
            error_callback;
        
        if (args.callbacks) {
            progress_callback = args.callbacks.progress,
            finished_callback = args.callbacks.finished,
            error_callback = args.callbacks.error;
        }
        
        // assumes that #writeChapter will always write following this pattern, which could cause problems
        var filepath = storageManager.getChapterFilePath(book_obj.id, chapter_obj.index);
        fileManager.testForFile(
            filepath,
            function (exists) {
                console.log(filepath, exists);
                if (!exists) {
                    downloadFile(
                        chapter_obj.url,
                        function (response) {
                            storageManager.writeChapter(response, book_obj, chapter_obj, finished_callback);
                        },
                        progress_callback
                    );
                } else {
                    console.warn('The file at ' + filepath + ' already exists.');
                    error_callback && error_callback();
                }
            }
        );
    }
}

var lf_getDeviceStorage = function (storage_str) {
    return navigator.getDeviceStorage && navigator.getDeviceStorage(storage_str || 'sdcard');
}

function BookStorageManager(args) {
    'use strict';
    var that = this,
        deviceStoragesManager = args.deviceStoragesManager,
        referenceManager = args.referenceManager;

    this.writeChapter = function (blob, book_obj, chapter_obj, func_done) {
        var chPath = that.getChapterFilePath(book_obj.id, chapter_obj.index);
        that.write(blob, chPath, function (saved_path) {
            referenceManager.storeChapterReference(book_obj, chapter_obj, saved_path, {
                reference_created: func_done
            });
        });
    };

    this.write = function (blob, path, success_fn) {
        console.log('writing:', blob, path);
        var request = deviceStoragesManager.getStorage().addFile(blob, path);
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
    
    this.getChapterFilePath = function (book_id, chapter_index) {
        return deviceStoragesManager.downloadsStorageName + APP_DOWNLOADS_DIR + '/' + book_id + '/' + chapter_index + '.lfa';
    };
}

function BookReferenceManager(args) {
    var args = args || {},
        async_storage = args.asyncStorage,
        fileManager = args.fileManager,
        obj_storage = {},
        that = this,
        JSON_PREFIX = this.JSON_PREFIX = 'bookid_',
        current_jobs = {};
    
    this.obj_storage = obj_storage; // for testing access

    function strip_functions (obj) { // assumes only top layer has functions
        var cloned_obj = jQuery.extend({}, obj);
        Object.keys(cloned_obj).forEach(function (key) {
            if (typeof cloned_obj[key] === 'function') {
                delete cloned_obj[key]
            }
        });
        return cloned_obj;
    }
    
    this.updateUserData = function (book_id, current_chapter_index, position) {
        that.loadBookReference(book_id, function (book_ref) {
            book_ref[PlayerProgressManager.USER_PROGRESS_KEY] = {
                current_chapter_index: current_chapter_index,
                position: position
            }
            store_item(JSON_PREFIX + book_id, book_ref);
        });
    }
    
    this.storeChapterReference = function (book_obj, chapter_obj, path, options) {
        options = options || {}
        if (!isValidIndex(book_obj.id)) {
            throw new Error('book_obj.id is not a valid index: ' + book_obj.id);
        }
        that.loadBookReference(book_obj.id, function (obj) {
            console.log('loadBookReference callback evaluated');
            var obj = obj || {};
            obj.title = obj.title || book_obj.title;
            obj.id = obj.id || book_obj.id;

            if (!isValidIndex(chapter_obj.index)) {
                throw new Error('chapter_obj.index is not a valid index: ' + chapter_obj.index);
            }
            obj[chapter_obj.index] = {
                path: path,
                name: chapter_obj.name
            };

            store_item(JSON_PREFIX + book_obj.id, obj);
            
            applyHelperFunctions(obj);
            obj_storage[JSON_PREFIX + book_obj.id] = obj;
            options.reference_created && options.reference_created(obj);
        });
    };
    
    function store_item (key, item) {
        var write_to_storage = function (key, item) {
            console.log('store_in_async called.')
            var obj_to_store = strip_functions(item);
            console.log('storing ', obj_to_store);
            async_storage.setItem(key, obj_to_store, function (transaction) {
                console.log('wrote to asyncStorage:', obj_to_store);
                var job = current_jobs[key];
                console.log('job.when_done is', job.when_done)
                var _when_done = job.when_done;
                job.when_done = undefined;
                _when_done && _when_done();
                job.status = 'DONE';
                console.log('DONE! job store is now ' + JSON.stringify(current_jobs))
            });
        },
            curr_job = current_jobs[key];
        
        if (curr_job && curr_job.status === 'WORKING') {
            console.log('currently job store is busy: ' + JSON.stringify(current_jobs) + ' so when_done is being set.');
            curr_job.when_done = function () {
                console.log('when_done called for job store ' + JSON.stringify(current_jobs) + ' and item ', item);
                write_to_storage(key, item);
            };
        } else {
            console.log('No current task for job store ' + JSON.stringify(current_jobs) + ', storing obj')
            current_jobs[key] = {
                status: 'WORKING',
                when_done: undefined
            };
            write_to_storage(key, item);
        }
    }

    this.loadBookReference = function (book_id, load_callback, prefix) {
        if (!prefix && prefix !== '') { // allow null prefix, but default to JSON_PREFIX. this is bad behavior :(
            prefix = JSON_PREFIX;
        }
        var os_book_ref = obj_storage[prefix + book_id];
        if (os_book_ref) {
            load_callback(os_book_ref);
        } else {
            async_storage.getItem( (prefix + book_id), function (obj) {
                if (obj_storage[prefix + book_id]) { // if the object has loaded since the async was called
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
                        that.loadBookReference(key, function (book_ref) {
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

    function applyHelperFunctions(book_ref) {
        if (!book_ref) {
            return undefined;
        }
        
        console.log('trying to apply helper functions to ', JSON.parse(JSON.stringify(book_ref)));
        if (typeof book_ref.hasHelperFunctions === 'function') {
            console.log('book_ref already had helper functions, not reapplying.');
            return book_ref;
        }
        
        book_ref.hasHelperFunctions = function () {};
        
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
            return fileManager.deleteFile(this_book_ref[index].path)
                .then(function () {
                    delete this_book_ref[index];
                    var key = JSON_PREFIX + this_book_ref.id;
                    if (this_book_ref.numChapters() === 0) {
                        remove_book_from_references(this_book_ref.id);
                    } else {
                        obj_storage[key] = this_book_ref;
                        
                        store_item(key, this_book_ref);
                    }
                    success_fn && success_fn();
                })
                .catch(function (err) {
                    console.warn('Error deleting chapter with index ' + index + '. ', err.name, err.stack);
                    alert('Error deleting chapter with index ' + index + '. ' + err.name);
                    throw err;
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
                            store_item(JSON_PREFIX + this_book_ref.id, this_book_ref);

                            error_fn && error_fn();
                        }
                    }
                };
            if (num_chapters > 0) {
                this_book_ref.eachChapter(function (chapter, index) {
                    fileManager.deleteFile(chapter.path)
                        .then(() => {
                            delete this_book_ref[index];
                            finalize_deletions_if_ready();
                        }).catch(err => {
                            console.error('Error deleting chapter with index ' + index + '. ' + err.name);
                            errors = true;
                            finalize_deletions_if_ready();
                        });
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


ID3Parser = (function () {
    // Hey, when I wrote this I was learning promises for the first time!
    // I read the A+ specification, and it seems like promises that don't chain
    // or return a value should use #done instead of #then.  But then I read some
    // other stuff saying #done isn't necessary. I ended up sticking with #then.
    
    // snippets and concepts from
    // https://github.com/mozilla-b2g/gaia/blob/27799d17c1e00ac4735088d083fdf25d5f460b13/apps/music/js/metadata/formats.js#L24-L67
    var parsers = [
        {
            file: 'js/lib/id3v1.js',
            get module() { return ID3v1Metadata; },
            test: function (header) {
                return (header.getUint16(0, false) & 0xFFFE) === 0xFFFA;
            }
        },
        {
            file: 'js/lib/id3v2.js',
            get module() { return ID3v2Metadata; },
            test: function (header) {
                return header.getASCIIText(0, 3) === 'ID3';
            }
        }
    ];
    
    function findParser (blobview) {
        for (var i = 0; i < parsers.length; i++) {
            if (parsers[i].test(blobview)) {
                return LazyLoader.load(parsers[i].file).then(function () {
                    return parsers[i].module;
                });
            }
        }
        return Promise.reject('could not parse metadata');
    }
    
    // snippets and concepts from
    // https://github.com/mozilla-b2g/gaia/blob/9dfedd7d35da00fa9b08dcffc3ab4f47da54e4f0/apps/music/js/metadata/core.js#L52-L83
    function parse (blob) {
        // according to mozilla metadata core.js, anything smaller than this cannot be a media file.
        if (blob.size < 128) {
          return Promise.reject('file is empty or too small');
        }
        return new Promise((resolve, reject) => {
            LazyLoader.load('js/lib/blobview.js').then(() => {
                var size = Math.min(6 * 1024, blob.size);
                BlobView.get(blob, 0, size, function (blobview, error) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    findParser(blobview).then(function (parser) {
                        var promise;
                        promise = parser.parse(blobview);

                        resolve(promise.then(function (metadata) {
                            return addDefaultMetadata(metadata || {}, blob.name);
                        }))
                    }).catch(e => {
                        reject(e)
                    });
                });
            }).catch(e => {
                console.error('ID3Parser.parse: ', e, e.stack);
                reject(e);
            });
        });
    }
    
    /**
     * Fill in any default metadata fields, such as a fallback for the title, and
     * the rating/playcount.
     *
     * @param {Object} metadata The metadata from one of our parsers.
     * @param {String} filename The name of the underlying file, if any.
     * @return {Object} The updated metdata object.
     */
    function addDefaultMetadata(metadata, filename) {
        if (!metadata.artist) {
            metadata.artist = '';
        }
        if (!metadata.album) {
            metadata.album = '';
        }
        if (!metadata.title) {
            // If the blob has a name, use that as a default title in case
            // we can't find one in the file
            if (filename) {
                var p1 = filename.lastIndexOf('/');
                var p2 = filename.lastIndexOf('.');
                if (p2 <= p1) {
                    p2 = filename.length;
                }
                metadata.title = filename.substring(p1 + 1, p2);
            } else {
                metadata.title = '';
            }
        }

        metadata.rated = metadata.played = 0;
        return metadata;
    }
    
    return {
        parse: parse
    };
})();

var MediaDBMetadataParser = (function () {
    'use strict';
    
    // selects paths that match any of the following:
    // (assuming APP_DOWNLOADS_DIR = librifox/app_dl)
    //
    // librifox/app_dl/01/01.lfa
    // sdcard/librifox/app_dl/01/01.lfa
    // /sdcard/librifox/app_dl/01/01.lfa
    // /sdcard1/librifox/app_dl/01/01.lfa
    // 
    // BUT does not match
    // 
    // /sdcard/other_folder/librifox/app_dl/01/01.lfa
    var inapp_download_path_matcher = new RegExp("^\/*(?:[^\/]+\/)?" + APP_DOWNLOADS_DIR + "\/(\\d+)\/(\\d+)\.lfa$")
    
    function getParser(id3_parser) {
        return function (blob, success, fail) {
            var match = blob.name.match(inapp_download_path_matcher);
            return id3_parser.parse(blob).catch(e => {
                console.warn('Encountered error ', e)
                return undefined;
            }).then(metadata => {
                if (match) {
                    console.log('detected file was downloaded by app ', match);
                    var _metadata = metadata || {}
                    _metadata.downloaded_in_app = true;
                    success(_metadata);
                } else if (metadata) {
                    success(metadata);
                } else {
                    fail();
                }
            });
        }
    }
    
    return {getParser: getParser};
})()

//var db = new MediaDB("sdcard", ID3Parser.getMediaDBMetadataParser(), {includeFilter: /[^\.]+\.lfa$/, version: 1});

var MediaManager = (function () {
    var db;
    function MediaManager(mediadb) {
        db = mediadb;
    }
    
    MediaManager.prototype.enumerate = function (callback) {
        db.enumerate((item) => {
            console.log(item);
        });
    }
    
    MediaManager.prototype.deleteDatabase = function () {
        var name = db.dbname;
        db.close();
        
        var req = indexedDB.deleteDatabase(name);
        req.onsuccess = function () {
            console.log("Deleted database successfully");
        };
        req.onerror = function () {
            console.log("Couldn't delete database");
        };
        req.onblocked = function () {
            console.log("Couldn't delete database due to the operation being blocked");
        };
    }
    
    return MediaManager;
})();

function FilesystemBookReferenceManager(args) {
    'use strict';
    
    var fileManager = args.fileManager,
        settings = args.settings,
        mediaDB = args.mediaDB,
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
                clear: function () {books_store = {}; untitled = []},
                store: books_store // temp
            };
        })();
    
    this.setCallback = function (each_book) {
        books.eachReference(function (book) { // in case books are parsed before callback is set
            each_book(book);
        });
        
        each_book_callback = each_book;
    };
    
    this.eachReference = function (func_each) {
        books.eachReference(func_each);
    };
    
    this.updateReferences = function () {
        books.clear();
        mediaDB.enumerate((listing) => {
            var metadata = listing.metadata,
                album = metadata.album,
                artist = metadata.artist;
            if (album) {
                var book_ref = books.getBook(metadata.album);
                if (!book_ref) {
                    book_ref = {
                        title: album,
                        author: artist
                    };
                }
                //book_ref[]
            }
        })
    }
    
    function createBookRefFromMediaListing(media_listing) {
        
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
}

function StoredBooksListPageGenerator(args) {
    "use strict";
    var that = this,
        referenceManager = args.bookReferenceManager,
        fsReferenceManager = args.fsBookReferenceManager,
        selectors,
        stored_chapters_data_handle = args.stored_chapters_data_handle,
        player = args.player;

    this.registerEvents = function (_selectors) {
        selectors = _selectors;
        if (!selectors.page) {
            console.warn('Selectors.page is falsy (undefined?), this causes the page event to be registered for all pages');
        }
        $(document).on('pagebeforeshow', selectors.page, function () {
            console.log('pagebeforeshow called for ' + selectors.page);
            that.refreshList();
            
            if (player.getCurrentInfo()) { // TODO use events to make this more robust
                $('.player-shortcut-footer').show();
            } else {
                $('.player-shortcut-footer').hide();
            }
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
            href: 'stored_book.html',
            click: function () {
                stored_chapters_data_handle(book_obj);
            }
        });
        return $('<li/>', {
            'class': 'stored-book',
            html: link
        });
    }
}

function StoredBookPageGenerator(args) {
    'use strict';
    
    var that = this,
        player_data_handle = args.player_data_handle,
        ui_state = {};
    
    this.getDataHandle = function () {
        return function (book) {
            ui_state.book = book;
        }
    }

    this.registerEvents = function (selectors) {
        if (!selectors.page) {
            console.warn('Selectors.page is falsy (undefined?), this causes the page event to be registered for all pages');
        }
        $(document).on('pagebeforeshow', selectors.page, function () {
            $(selectors.header_title).text(ui_state.book.title);
            var $list = $(selectors.list);
            $list.children('li.stored-chapter').remove();
            
            var user_progress = ui_state.book[PlayerProgressManager.USER_PROGRESS_KEY];
            if (user_progress && user_progress.current_chapter_index >= 0) {
                $('.continue-playback')
                    .show()
                    .click(function () {
                        player_data_handle(
                            ui_state.book,
                            user_progress.current_chapter_index,
                            {
                                position: user_progress.position,
                                resume_playback: true
                            })
                    });
            }
            
            ui_state.book.eachChapter(function (chapter_ref, index) {
                createListItem(chapter_ref, index).bind('taphold', function () {
                    var that = this;
                    $(selectors.book_actions_popup).popup('open', {
                        transition: 'pop',
                        positionTo: that // neat, positions over the held element!
                    });
                    $(selectors.book_actions_popup + ' .delete_chapter').click(function () {
                        ui_state.book.deleteChapter(index, function () {
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
            href: 'player.html',
            text: chapter_ref.name,
            click: function () {
                player_data_handle(ui_state.book, chapter_index, {resume_playback: false});
            }
        });
        return $('<li/>', {
            'class': 'stored-chapter',
            html: link
        });
    }
}
EventManager = (function () {
    "use strict";
    
    function Event(name) {
        this.name = name;
        this.callbacks = [];
    }
    Event.prototype.registerCallback = function (callback_obj) {
        this.callbacks.push(callback_obj);
    }

    // I think this will memory leak due to strong references
    // but I don't know how to work around that.
    var events;
    function EventManager () {
        this.events = events = {};
    }
    var namespace_rxp = /([^\.]*)(?:\.(.*))?/

    EventManager.prototype.registerEvent = function (eventName) {
        if (arguments.length > 1) {
            console.error('Wrong number of arguments!');
        }
        var event = new Event(eventName);
        events[eventName] = event;
    };
    
    EventManager.prototype.registerEvents = function () {
        var args = argumentsToArray(arguments),
            that = this;
        args.forEach(function (eventName) {
            that.registerEvent(eventName);
        });
    }

    EventManager.prototype.trigger = function (eventName, eventArgs) {
        events[eventName].callbacks.forEach(function (callback_obj) {
            callback_obj.callback(eventArgs);
        });
    };

    /*
     * Matches events, with optional namespace separated by a '.'
     * For example:
     * 'click'              -> event_name 'click', namespace undefined
     * 'click.my.namespace' -> event_name 'click', namespace 'my.namespace'
     */
    EventManager.prototype.on = function (event_string, callback) {
        var event_match = event_string.match(namespace_rxp),
            event_name = event_match[1],
            namespace  = event_match[2];
        if (!this.events[event_name]) {
            console.error(event_name + ' is not a valid event. Valid events: ' + Object.keys(this.events).join(', '));
            return;
        }
        this.events[event_name].registerCallback({
            callback: callback,
            namespace: namespace
        });
    };
    
    var remove_namespace_callbacks = function (callback_objs, namespace) {
            var i;
            for (i = 0; i < callback_objs.length; i++) {
                if (callback_objs[i].namespace === namespace) {
                    callback_objs.splice(i, 1); // can't use delete here!
                }
            }
        },
        getEventCallbacks = function (key) {
            return events[key].callbacks;
        }
    
    /*
     * Usage:
     *     #off('eventName') -> removes all callbacks for event with matching name
     *     #off('eventName.namespace') -> removes all callbacks with matching namespace for event with matching name 
     *     #off('*.namespace) -> removes callbacks with matching namespace for all events
     */
    EventManager.prototype.off = function (event_string) {
        if (event_string[0] === '*') {
            var namespace = event_string.slice(2);
            Object.keys(this.events).forEach(function (key) {
                remove_namespace_callbacks(getEventCallbacks(key), namespace);
            });
        } else {
            var event_match = event_string.match(namespace_rxp),
                event_name = event_match[1],
                namespace  = event_match[2];


            if (!namespace) {
                this.events[event_name].callbacks = [];
            } else {
                remove_namespace_callbacks(getEventCallbacks(event_name), namespace)
            }
        }
    }
    
    return EventManager;
})();

function PlayerProgressManager (args) {
    'use strict';
    var lastPosition = 0,
        player = args.player,
        referenceManager = args.referenceManager;
    
    player.on('timeupdate', function () {
        if ( Math.abs(player.position() - lastPosition) >= 30) {
            write();
        }
    });
    
    player.on('pause', function () {
        if (Math.abs(player.position() - lastPosition) >= 1) {
            write();
        }
    });
    
    player.on('loadeddata', function () {
        write();
    });
    
    player.on('finishedqueue', function (old_info) {
        var user_progress = {
            book: old_info.book,
            curr_index: -1
        };
        write(user_progress);
    });
    
    var write = function (curr_info) { // curr_info is an optional argument
        var curr_info = curr_info || player.getCurrentInfo();
        lastPosition = player.position() || 0;
        
        if (curr_info) {
            console.log('writing ', curr_info)
            referenceManager.updateUserData(curr_info.book.id, curr_info.curr_index, lastPosition);
        } else {
            console.log('no player info, nothing to write.');
        }
    }
}
PlayerProgressManager.USER_PROGRESS_KEY = 'user_progress';

function Player(args) {
    "use strict";
    var audio_element,
        create_object_url_fn = args.createObjectURL || URL.createObjectURL,
        fileManager = args.fileManager,
        player_options,
        queue_info,
        event_manager = new EventManager(),
        that = this;
    
    function onMetadataLoad () {
        event_manager.trigger('loadedmetadata');
        player_options.load_metadata && player_options.load_metadata.apply(this, arguments);
    }
    function onLoad () {
        if (player_options.autoplay) {
            that.play();
        }
        if (isFinite(player_options.desired_position) && player_options.desired_position >= 0) {
            that.position(player_options.desired_position);
            delete player_options.desired_position;
        }
        event_manager.trigger('loadeddata');
        player_options.load_data && player_options.load_data.apply(this, arguments);
    }
    function onEnded () {
        event_manager.trigger('ended');
        player_options.ended && player_options.ended.apply(this, arguments);
    }
    function onTimeUpdate () {
        event_manager.trigger('timeupdate');
        player_options.timeupdate && player_options.timeupdate.apply(this, arguments);
    }
    function onError (path) {
        var error_str;
        if (that.getCurrentInfo()) {
            error_str = 'Error loading chapter "' +
                        that.getCurrentInfo().chapter.name +
                        '" with path ' + that.getCurrentInfo().chapter.path +
                        '. Is the file corrupted?'
        } else if (path) {
            error_str = 'Error loading file from path ' + path
        } else {
            error_str = 'Something went wrong while loading audio into the player.'
        }
        console.error(error_str);
        alert(error_str);
    }
    
    event_manager.registerEvents('loadedmetadata', 'loadeddata', 'play', 'pause', 'timeupdate', 'ended', 'finishedqueue');
    
    this.on = function (eventName, callback) {
        event_manager.on(eventName, callback);
    }
    this.off = function (eventName) {
        event_manager.off(eventName);
    }
    
    this.queueBook = function (obj, index, options) {
        queue_info = {
            book: obj,
            curr_index: index
        };
        options = options || {};
        if (!options.hasOwnProperty('autoplay')) { // set queueBook to autoplay by default
            options.autoplay = true;
        }
        
        var user_set_ended = options.ended;
        options.ended = function () {
            that.next();
            user_set_ended && user_set_ended.apply(this, arguments);
        };
        
        audio_element = getAudioElement();
        if (obj[index]) {
            that.playFromPath(obj[index].path, options);
        } else {
            console.warn('Could not find the requested chapter.');
        }
    }
    
    this.next = function () {
        if (queue_info) {
            var index = queue_info.curr_index;
            event_manager.trigger('ended');
            if (queue_info.book.hasOwnProperty(index + 1)) {
                that.playFromPath(queue_info.book[index + 1].path, player_options);
                queue_info.curr_index += 1;
            } else {
                console.log('Ending playback, no chapter with index ' + (index + 1));
                that.pause();
                audio_element = undefined;
                var old_queue_info = queue_info;
                queue_info = undefined;
                event_manager.trigger('finishedqueue', old_queue_info);
            }
        } else {
            console.warn('Could not go to next track, nothing in queue.');
        }
    }
    
    this.playFromPath = function (path, options) {
        player_options = options || {};
        fileManager.getFileFromPath(
            path,
            function (file) {
                console.log(file.type, file);
                getAudioElement().src = create_object_url_fn(file);
            }, () => {
                onError(path);
            }
        );
    }
    
    this.play = function () {
        event_manager.trigger('play');
        audio_element.play();
    }
    this.pause = function () {
        event_manager.trigger('pause');
        audio_element.pause();
    }
    this.togglePlaying = function () {
        if (audio_element.paused) {
            that.play();
        } else {
            that.pause();
        }
    }
    this.paused = function () {
        return audio_element.paused;
    }
    
    this.position = function (desired_time) {
        if (arguments.length === 0) {
            return audio_element ? audio_element.currentTime : NaN;
        } else {
            audio_element.currentTime = desired_time;
        }
    };
    this.positionPercent = function (desired_percentage) {
         if (arguments.length === 0) {
            return audio_element.currentTime / audio_element.duration;
        } else {
            audio_element.currentTime = desired_percentage * audio_element.duration;
        }
    }
    this.duration = function () {
        return audio_element.duration;
    }
    
    // TODO: this function doesn't belong here :(
    this.prettifyTime = function (float_secs, joiner) {
        var remove_decimal = function (num) {
                // ~~ operator chops off the decimal
                return ~~num
            },
            stringify_two_digits = function (num) {
                var stringified_num = num.toString()
                if (num < 10) {
                    stringified_num = '0' + stringified_num;
                }
                
                return stringified_num;
            },
            joiner  = joiner || ':',
            hours   = remove_decimal(float_secs / 3600),
            minutes = remove_decimal(float_secs / 60) % 60,
            seconds = remove_decimal(float_secs) % 60,
            arr = [];
        
        hours && arr.push(hours);
        arr.push(hours ? stringify_two_digits(minutes) : minutes);
        arr.push(stringify_two_digits(seconds));
        return arr.join(joiner);
    }
    
    function getAudioElement () {
        if (!audio_element) {
            audio_element = new Audio();

            if (navigator.mozAudioChannelManager) {
                navigator.mozAudioChannelManager.volumeControlChannel = 'content';
            }
            audio_element.mozAudioChannelType = 'content';
            
            audio_element.addEventListener('loadedmetadata', onMetadataLoad);
            audio_element.addEventListener('loadeddata', onLoad);
            audio_element.addEventListener('ended', onEnded);
            audio_element.addEventListener('timeupdate', onTimeUpdate);
            audio_element.addEventListener('error', onError);
        }
        
        return audio_element
    }
    this.getAudioElement = getAudioElement;
    
    this.getCurrentInfo = function () {
        if (!queue_info) {
            return null;
        } else {
            return {
                book: queue_info.book,
                curr_index: queue_info.curr_index,
                chapter: queue_info.book[queue_info.curr_index]
            };
        }
    }
}

function BookPlayerPageGenerator(args) {
    "use strict";
    var player_context,
        fileManager = args.fileManager,
        player = args.player,
        that = this;
    
    this.getDataHandle = function () {
        return function (curr_book, chapter_index, options) {
            player_context = {};
            player_context.book = curr_book;
            player_context.chapter_index = chapter_index;
            if (options) {
                player_context.position = options.position;
                player_context.resume_playback = options.resume_playback;
            }
            
            if (!player_context.hasOwnProperty('resume_playback')) {
                player_context.resume_playback = true;
            }
        }
    }

    this.registerEvents = function (selectors) {
        var page = selectors.page;
        $(document).on("pagebeforeshow", selectors.page, function (event) {
            console.log('player.html page being generated...');
            
            var controls = selectors.controls;
            
            if (
              !player.getCurrentInfo() ||   // if nothing is playing OR
              ( player.getCurrentInfo() &&  // if thing playing doesn't match thing 
                player_context &&           //   requested via player_context...
                (
                  player.getCurrentInfo().book.id !== player_context.book.id ||
                  player.getCurrentInfo().curr_index !== player_context.chapter_index
                )
              )
            ) {                             // then queue the book
                var options;
                if (player_context.position) {
                    options = {desired_position: player_context.position};
                }
                player.queueBook(player_context.book, player_context.chapter_index, options);
                player_context = undefined; // delete player context and use
                                            // player.getCurrentInfo()
            } else if (player_context.resume_playback) {
                player.play();
            }

            updateUIandContext(selectors, controls);
            
            player.on('timeupdate.player-html', function () {
                $(concatSelectors(controls.container, controls.position)).val(player.positionPercent());
                $(concatSelectors(controls.container, controls.position)).slider('refresh');
                $(concatSelectors(controls.container, controls.position_text)).text(player.prettifyTime(player.position()));
            });
            
            player.on('loadeddata.player-html', function () {
                updateUIandContext(selectors, controls);
            });
            
            player.on('play.player-html', function () {
                console.log('play event fired');
                $(concatSelectors(controls.container, controls.play)).text('Pause');
            });
            
            player.on('pause.player-html', function () {
                $(concatSelectors(controls.container, controls.play)).text('Play');
            });
            
            player.on('finishedqueue.player-html', function () {
                $.mobile.back();
                alert('finished all chapters in queue');
            });
            
            var was_paused = true;
            $(concatSelectors(controls.container, controls.position)).on('slidestart', function () {
                was_paused = player.paused();
                player.pause();
            });
            $(concatSelectors(controls.container, controls.position)).on('slidestop', function (event) {
                player.positionPercent($(this).val());
                if (!was_paused) {
                    player.play();
                }
            });
            
            $(concatSelectors(controls.container, controls.play)).click(function () {
                player.togglePlaying();
            });
            $(concatSelectors(controls.container, controls.next)).click(function () {
                player.next();
            });
            $(concatSelectors(controls.container, controls.stepback)).click(function () {
                player.position(player.position() - 30);
            });
        });
        
        $(document).on('pagehide', selectors.page, function (event) {
            player.off('*.player-html');
        });
    };
    
    function updateUIandContext (selectors, controls) {
        if (player.getCurrentInfo()) {
            $(selectors.header).text(player.getCurrentInfo().chapter.name);
            
            player.position() && $(concatSelectors(controls.container, controls.position_text)).text(player.prettifyTime(player.position()));
            player.duration() && $(concatSelectors(controls.container, controls.duration_text)).text(player.prettifyTime(player.duration()));
        } else {
            console.warn('player.getCurrentInfo() is falsy');
        }
    }
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

function DeviceStoragesManager(args) { // untested
    'use strict'
    var settings = args.settings,
        downloads_storage_index,
        downloads_storage_name,
        filemanager_wrapped_storage,
        nav = args.navigator || navigator;
    
    settings.getAsync('downloads_storage_device_index', value => {
        this.setDownloadsDeviceByIndex(value || 0);
    });
    
    this.setDownloadsDeviceByIndex = function (index) {
        if (isFinite(index) && Math.floor(index) == index) {
            settings.set('downloads_storage_device_index', index);
            downloads_storage_index = index;
            
            downloads_storage_name = nav.getDeviceStorages('sdcard')[index].storageName;            
        } else {
            console.error('The index ' + index + ' was not valid');
        }
    };
    
    Object.defineProperty(this, 'downloadsStorageName', {
        get: () => {
            if (!downloads_storage_name) {
                console.error('No name for current storage device!');
                return '';
            } else {
                return '/' + downloads_storage_name + '/'
            }
        }
    });
    
    this.getDownloadsDeviceIndex = function () {
        return downloads_storage_index;
    };
    
    this.getStorage = function () {
        if (!filemanager_wrapped_storage) {
            filemanager_wrapped_storage = new FileManager(nav.getDeviceStorage('sdcard'));
        }
        return filemanager_wrapped_storage;
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
            enumerate_path: APP_DOWNLOADS_DIR,
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

    this.addFile = function (blob, filepath) {
        return storage_device.addNamed(blob, filepath);
    };
    
    this.deleteFile = function (filepath) {
        return new Promise(function (resolve, reject) {
            var req = storage_device.delete(filepath);
            req.onsuccess = function () {
                resolve.apply(this, arguments);
            }
            req.onerror = function () {
                reject.apply(this, arguments);
            }
        });
    }
    
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
            match: new RegExp(APP_DOWNLOADS_DIR + "\/.*"),
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
    
    this.mozStorageDevice = storage_device;
}

function SearchResultsPageGenerator(args) {
    var httpRequestHandler = args.httpRequestHandler,
        results_selector = args.results_selector,
        sr_chapters_data_handle = args.sr_chapters_data_handle,
        resultsCache = {},
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
                    resultsCache[book.id] = book;
                    $('<li/>').html(
                        $('<a>')
                            .attr('href', 'searched_book.html')
                            .append(
                                $('<h2/>').text(book.title)
                            )
                            .append(
                                $('<p/>').text(book.description)
                            )
                    ).click(function () {
                        sr_chapters_data_handle(book);
                    }).appendTo(results_selector);
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
        httpRequestHandler = new HttpRequestHandler(),
        player = new Player({
            fileManager: fileManager
        }),
        deviceStoragesManager = new DeviceStoragesManager({
            settings: settings    
        }),
        bookReferenceManager = new BookReferenceManager({
            asyncStorage: asyncStorage,
            fileManager: fileManager
        }),
        playerProgressManager = new PlayerProgressManager({
            player: player,
            referenceManager: bookReferenceManager
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
        bookPlayerPageGenerator = new BookPlayerPageGenerator({
            fileManager: fileManager,
            player: player
        }),
        storedBookPageGenerator = new StoredBookPageGenerator({
            player_data_handle: bookPlayerPageGenerator.getDataHandle(),
        }),
        searchedBookPageGenerator = new SearchedBookPageGenerator({
            httpRequestHandler: httpRequestHandler,
            selectors: {
                page: '#searchedBookPage',
                list: '.searched-chapters-list',
                book_title: '.book-title-disp',
                book_description: '.book-desc-disp',
                footer_alert: '#stored-chapters-shortcut-footer'
            },
            bookDownloadManager: bookDownloadManager,
            bookReferenceManager: bookReferenceManager,
            stored_chapters_data_handle: storedBookPageGenerator.getDataHandle()
        }),
        searchResultsPageGenerator = new SearchResultsPageGenerator({
            httpRequestHandler: httpRequestHandler,
            results_selector: '#results-listing',
            sr_chapters_data_handle: searchedBookPageGenerator.getDataHandle()
        }),
        bookReferenceValidator = new BookReferenceValidator({
            referenceManager: bookReferenceManager,
            fileManager: fileManager
        }),
        fsBookReferenceManager = new FilesystemBookReferenceManager({
            fileManager: fileManager,
            settings: settings
        }),
        storedBooksListPageGenerator = new StoredBooksListPageGenerator({
            bookReferenceManager: bookReferenceManager,
            fsBookReferenceManager: fsBookReferenceManager,
            stored_chapters_data_handle: storedBookPageGenerator.getDataHandle(),
            player: player
        }),
        settingsPageGenerator = new SettingsPageGenerator({
            settings: settings,
            deviceStoragesManager: deviceStoragesManager
        });

    bookReferenceValidator.registerEvents(lf_getDeviceStorage());
    bookReferenceValidator.validateMetadata(function (invalid_paths) {
        console.log(invalid_paths);
        alert('Warning: the following files were not retrieved ' + invalid_paths.join(', '));
        storedBooksListPageGenerator.refreshList();
    });
    //fsBookReferenceManager.findAllChapters();
    storedBooksListPageGenerator.registerEvents({
        list: '#stored-books-list',
        page: '#storedBooksList',
        book_actions_popup: '#bookActionsMenu',
    });
    storedBookPageGenerator.registerEvents({
        header_title: '.book-title',
        list: '#stored-chapters-list',
        page: '#storedBookPage',
        book_actions_popup: '#chapterActionsMenu'
    });
    bookPlayerPageGenerator.registerEvents({
        page: '#bookPlayer',
        header: '.player-header',
        controls: {
            container: '.player-controls',
            play: '.play',
            next: '.next',
            stepback: '.back-30',
            position: '.time-slider',
            position_text: '.time-readout',
            duration_text: '.total-duration-readout'
        }
    });
    searchResultsPageGenerator.registerEvents({
        page: "#bookSearch",
        form: "#search-form",
        search: "#books-search-bar",
        settings_popup: '#search-settings'
    });
    searchedBookPageGenerator.registerEvents();
    settingsPageGenerator.registerEvents({
        page: '#mainSettings',
        folder_path_form: '#user-folder-form'
    });

    $(document).on("pagebeforeshow", "#homeFileManager", function () {
        $('#deleteAll').click(function () {
            fileManager.deleteAllAppFiles();
            asyncStorage.clear(); // remove references
        });
        fileManager.displayAppFiles();
    });
    
    _player = player;
}