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
    var httpRequestHandler = args.httpRequestHandler,
        list_selector = args.list_selector,
        header_selector = args.header_selector,
        bookDownloadManager = args.bookDownloadManager,
        PROGRESSBAR_HTML =  '<div class="progressBar" style="display: none">' +
                            '<div class="progressBarSlider"></div></div>';

    this.generatePage = function (book) {
        $(header_selector).text(book.title); // untested, TODO update tests

        if (book.chapters) {
            showLocalChapters(book);
        } else {
            getChaptersFromFeed(book.id, function (chapters) {
                book.chapters = chapters;
                showLocalChapters(book);
            });
        }
    };

    function showLocalChapters(book) {
        var $dl_all = $('<li/>', {
                html: $('<a/>', {
                    text: 'Download all chapters (WIP)'
                }),
                click: function () {
                    var that = this;
                    book.chapters.forEach(function (chapter) {
                        downloadChapterWithCbk(book, chapter, that);
                    });
                }
            });
        $dl_all.append(PROGRESSBAR_HTML);
        
        $(list_selector).append($dl_all);
        $.each(book.chapters, function (index, chapter) {
            generateChapterListItem(book, chapter, this);
        });
        $(list_selector).listview('refresh');
    };

    function generateChapterListItem(book, chapter) {
        var $chapterListItem = $('<li/>')
            .addClass('chapter-listing')
            .attr('chapter-index', chapter.index)
            .html(
                $('<a/>')
                    .append($('<h2/>', {text: chapter.name}))
                    .append(PROGRESSBAR_HTML)
                );
            
        $chapterListItem.click(function () {
            downloadChapterWithCbk(book, chapter, this);
        });
        $(list_selector).append($chapterListItem);
    }
    
    function downloadChapterWithCbk(book, chapter, that) {
        return bookDownloadManager.downloadChapter(
            book,
            chapter,
            function (event) { // move this into a new object
                if (event.lengthComputable) {
                    var percentage = (event.loaded / event.total) * 100;
                    $(that).find('.progressBar').show();
                    $(that).find('.progressBarSlider').css('width', percentage + '%');
                }
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
        storageManager = args.storageManager;

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

    this.downloadChapter = function (book_obj, chapter_obj, progress_callback) {
        downloadFile(
            chapter_obj.url,
            function (response) {
                storageManager.writeChapter(response, book_obj, chapter_obj);
            },
            progress_callback
        );
    }
}

$(document).on("pagecreate", "#chaptersListPage", function (event) {
    var selectedBook = appUIState.currentBook;
    if (!selectedBook) { // selectedBook is undefined if you refresh the app from WebIDE on a chapter list page
        console.warn("Chapters List: selectedBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
        return false;
    }
    chaptersListGen.generatePage(selectedBook);
});

var lf_getDeviceStorage = function (storage_str) {
    return navigator.getDeviceStorage && navigator.getDeviceStorage(storage_str || 'sdcard');
}

function BookStorageManager(args) {
    var that = this,
        storageDevice = args.storageDevice,
        referenceManager = args.referenceManager;

    this.writeChapter = function (blob, book_obj, chapter_obj) {
        var chPath = that.getChapterFilePath(book_obj.id, chapter_obj.index);
        that.write(blob, chPath);
        referenceManager.storeJSONReference(book_obj, chapter_obj, chPath);
    };

    this.write = function (blob, path) {
        console.log('writing:', blob, path);
        var request = storageDevice.addNamed(blob, path);
        if (request) {
            request.onsuccess = function () {
                console.log('wrote: ' + this.result);
            };
        }
    };
    
    this.delete = function (path, success_fn, error_fn) {
        var request = storageDevice.delete(path);
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
        return 'librifox/' + book_id + '/' + chapter_index + '.mp3';
    };
}

function BookReferenceManager(args) {
    var args = args || {},
        local_storage = args.localStorage || localStorage,
        that = this,
        storageManager = args.storageManager;
    this.JSON_PREFIX = 'bookid_';

    this.storeJSONReference = function (book_obj, chapter_obj, path) {
        if (!isValidIndex(book_obj.id)) {
            throw new Error('book_obj.id is not a valid index: ' + book_obj.id);
        }
        var obj   = that.loadJSONReference(book_obj.id) || {};
        obj.title = obj.title || book_obj.title;
        obj.id    = obj.id    || book_obj.id;
        
        if (!isValidIndex(chapter_obj.index)) {
            throw new Error('chapter_obj.index is not a valid index: ' + chapter_obj.index);
        }
        obj[chapter_obj.index] = {
            path: path,
            name: chapter_obj.name
        };
        local_storage.setItem(that.JSON_PREFIX + book_obj.id, JSON.stringify(obj));
    };

    this.loadJSONReference = function (book_id) {
        var book_ref = JSON.parse(local_storage.getItem(that.JSON_PREFIX + book_id));
        return book_ref && applyHelperFunctions(book_ref);
    };

    this.eachReference = function (each_fn) {
        Object.keys(local_storage).forEach(function (key) {
            console.log(key);
            if (key.startsWith(that.JSON_PREFIX) && local_storage.hasOwnProperty(key)) {
                var book_ref = JSON.parse(local_storage.getItem(key));
                applyHelperFunctions(book_ref);
                each_fn(book_ref);
            }
        });
    };
    
    this.registerStorageManager = function (_storageManager) {
        storageManager = _storageManager;
    };

    function applyHelperFunctions(book_ref) {
        book_ref.eachChapter = function (each_fn) {
            Object.keys(book_ref).forEach(function (key) {
                if (isValidIndex(key) && book_ref.hasOwnProperty(key)) {
                    each_fn(book_ref[key], key);
                }
            });
        };
        
        book_ref.deleteChapter = function (index, success_fn) {
            var this_book_ref = this;
            storageManager.delete(this_book_ref[index].path,
                function () {
                    delete this_book_ref[index];
                    var key = that.JSON_PREFIX + this_book_ref.id;
                    console.log(key, index, JSON.stringify(this_book_ref));
                    local_storage.setItem(key, JSON.stringify(this_book_ref));
                    success_fn();
                },
                function (err) {
                    alert('Error deleting chapter with index ' + index + '. ' + err.name)
                });
            
        };
        return book_ref;
    }

    function isValidIndex(index) {
        return /^\d+$/.test(index)
    }
}
var bookReferenceManager = new BookReferenceManager({
        storageManager: bookStorageManager
    }),
    bookStorageManager = new BookStorageManager({
        storageDevice: lf_getDeviceStorage(),
        referenceManager: bookReferenceManager
    }),
    bookDownloadManager = new BookDownloadManager({
        httpRequestHandler: httpRequestHandler,
        storageManager: bookStorageManager,
        referenceManager: bookReferenceManager
    }),
    chaptersListGen = new ChaptersListPageGenerator({
        'httpRequestHandler': httpRequestHandler,
        'list_selector': '#chaptersList',
        'header_selector': '#chapterHeader',
        'bookDownloadManager': bookDownloadManager
    });
bookReferenceManager.registerStorageManager(bookStorageManager);

function StoredBooksPageGenerator(args) {
    var that = this,
        referenceManager = args.bookReferenceManager,
        ui_state = args.ui_state;

    this.registerEvents = function (selectors) {
        if (!selectors.page) {
            console.warn('Selectors.page is falsy (undefined?), this causes the page event to be registered for all pages');
        }
        $(document).on('pageshow', selectors.page, function () {
            console.log('pageshow called for ' + selectors.page);
            var $list = $(selectors.list);
            $list.children('li.stored-book').remove();
            referenceManager.eachReference(function (obj) {
                var link = $('<a/>', {
                    class: 'showFullText',
                    text: obj.title,
                    href: 'stored_chapters.html',
                    click: function () {
                        ui_state.book_ref = obj
                    }
                });
                $('<li/>', {
                    class: 'stored-book',
                    html: link
                }).appendTo($list);
            });
            $list.listview('refresh');
        });
    };
}

function StoredChaptersPageGenerator(args) {
    var that = this,
        ui_state = args.ui_state;

    this.registerEvents = function (selectors) {
        if (!selectors.page) {
            console.warn('Selectors.page is falsy (undefined?), this causes the page event to be registered for all pages');
        }
        $(document).on('pageshow', selectors.page, function () {    
            console.log('storedChapters shown');
            $(selectors.header_title).text(ui_state.book_ref.title);
            var $list = $(selectors.list);
            $list.children('li.stored-chapter').remove();
            ui_state.book_ref.eachChapter(function (chapter_ref, index) {
                var link = $('<a/>', {
                    class: 'showFullText',
                    href: 'book.html',
                    text: chapter_ref.name,
                    click: function () {
                        ui_state.chapter_ref = chapter_ref;
                    }
                }).bind('taphold', function () {
                    var that = this;
                    ui_state.book_ref.deleteChapter(index, function () {
                        $(that).parent().remove();
                        $(selectors.page + ' ul').listview('refresh');
                    })
                });
                $('<li/>', {
                    class: 'stored-chapter',
                    html: link
                }).appendTo($list);
            });
            $list.listview('refresh');
        });
    };
}

function BookPlayerPageGenerator(args) {
    var ui_state = args.ui_state,
        page;

    this.generatePage = function (audio_url, chapter_name) {
        $(args.selectors.audio).prop("src", audio_url);
        $(args.selectors.header).text(chapter_name);
    };

    this.registerEvents = function (selectors) {
        page = selectors.page;
        console.log('test');
        $(document).on("pagecreate", selectors.page, function (event) {
            if (!ui_state.chapter_ref) {
                console.warn("Chapters List: the chapter reference was undefined, which freezes the app.  Did you refresh from WebIDE?");
                return false;
            }
            var sdcard = lf_getDeviceStorage();
            var request = sdcard.get(ui_state.chapter_ref.path);
            request.onsuccess = function () {
                var file = this.result;
                var file_url = ui_state.file_url = URL.createObjectURL(file);
                bookPlayerPageGenerator.generatePage(file_url, ui_state.chapter_ref.name);
            };
            request.onerror = function () {
                console.log(this.error);
            };
        });
        $(document).on('pagebeforehide', selectors.page, function (event) {
            console.log('pagehide called - revoking url for ' + ui_state.file_url);
            URL.revokeObjectURL(ui_state.file_url);
            
            /* 
             * For whatever reason, this is required, otherwise mp3s that have been loaded cannot be deleted.
             * I don't really know why this is necessary, and why revoking the object url isn't enough, but
             * it isn't.  Oh, Firefox OS...
             * Also, if the app is crashed or forced closed, this event doesn't fire and the user can't delete
             * the file until they restart their phone (?)
             */
            $(args.selectors.audio).prop("src", '');
        });
    };
}

var ui_state = {},
    storedBooksPageGenerator = new StoredBooksPageGenerator({
        bookReferenceManager: bookReferenceManager,
        ui_state: ui_state
    }),
    storedChaptersPageGenerator = new StoredChaptersPageGenerator({
        ui_state: ui_state
    }),
    bookPlayerPageGenerator = new BookPlayerPageGenerator({
        selectors: {
            audio: '#audioSource',
            header: '.book-player-header'
        },
        ui_state: ui_state
    });

storedBooksPageGenerator.registerEvents({
    list: '#stored-books-list',
    page: '#storedBooks'
});
storedChaptersPageGenerator.registerEvents({
    header_title: '.chapter-title',
    list: '#stored-chapters-list',
    page: '#storedChapters'
});
bookPlayerPageGenerator.registerEvents({page: '#book-player'});


var fileManager = new FileManager(lf_getDeviceStorage());
$(document).on("pageshow", "#homeFileManager", function () {
    $('#deleteAll').click(function () {
        fileManager.deleteAllAppFiles();
        localStorage.clear(); // remove references
    });
    fileManager.displayAppFiles();
});

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
            match: /librifox\/.*/,
            func_each: enumeration_cb,
            func_done: done_cb
        });
    }

    this.enumerateFiles = function (args) {
        var match = args.match,
            func_each = args.func_each,
            func_done = args.func_done,
            func_error = args.func_error;

        var request = storage_device.enumerate();
        request.onsuccess = function () {
            if (this.result) {
                if (this.result.name.match(match)) {
                    console.log('calling func_each');

                    func_each(this.result);
                }
                this.continue();
            } else {
                console.log('calling func_done');
                func_done();
            }
        };
        request.onerror = function () {
            func_error && func_error();
        };
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
}

function SearchResltsPageGenerator(args) {
    var httpRequestHandler = args.httpRequestHandler,
        results_selector = args.results_selector,
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
                    'No books found, try simplifying your search.<br/>' +
                    'The LibriVox search API is not very good, so we' +
                    'apologize for the inconvenience.</p>');
            }
        });
    }

    function getSearchJSON(search_string, callback_func) {
        httpRequestHandler.getJSON(generateBookUrl(search_string), function (xhr) {
            callback_func(xhr.response.books);
        });
    }

    function generateBookUrl(search_string) { // this should be private, but I want to test it :(
        return "https://librivox.org/api/feed/audiobooks/title/^" + encodeURIComponent(search_string) + "?&format=json";
    }
}
var searchResultsPageGenerator =
    new SearchResltsPageGenerator({
        'httpRequestHandler': httpRequestHandler,
        'results_selector': '#results-listing'
    });
searchResultsPageGenerator.registerEvents({
    page: "#bookSearch",
    form: "#search-form",
    search: "#books-search-bar"
});

function HttpRequestHandler() {
    var that = this;

    this.getDataFromUrl = function (url, type, load_callback, other_args) // NEEDS MORE MAGIC STRINGS
        {
            other_args = other_args || {};
            var xhr = new XMLHttpRequest({
                mozSystem: true
            });

            if (xhr.overrideMimeType && type == 'json') {
                xhr.overrideMimeType('application/json');
            }

            other_args.error_callback = other_args.error_callback || function (e) {
                console.log("error loading json from url " + url);
                console.log(e);
            }
            other_args.timeout_callback = other_args.timeout_callback || function (e) {
                console.log("timeout loading json from url " + url);
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
            if (type != 'default') {
                xhr.responseType = type;
            }
            xhr.send();
        }

    this.getJSON = function (url, load_callback, other_args) {
        that.getDataFromUrl(url, 'json', load_callback, other_args);
    };
    this.getXML = function (url, load_callback, other_args) {
        that.getDataFromUrl(url, 'default', load_callback, other_args);
    };
    this.getBlob = function (url, load_callback, other_args) {
        that.getDataFromUrl(url, 'blob', load_callback, other_args);
    };
}