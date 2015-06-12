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
    this.name = stripHTMLTags(name_match[1] || args.name); // if regex doesn't match, fall back to raw string
    this.index = args.index; // TODO: Add whenever this method is called, return current chapter or get it if not available
    this.url = args.url;
    this.position = 0;
}

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
    var args = args || {};
    var httpRequestHandler = args.httpRequestHandler;
    var list_selector = args.list_selector;
    var header_selector = args.header_selector;
    var bookDownloadManager = args.bookDownloadManager;

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
        $(list_selector).append($('<li/>', {
            html: $('<a/>', {
                text: 'Download all chapters (WIP)'
            }),
            click: function () {
                book.chapters.forEach(function (chapter) {
                    downloadChapterWithCbk(book,chapter);
                });
            }
        }));
        $.each(book.chapters, function (index, chapter) {
            generateChapterListItem(book, chapter, this);
        });
        $(list_selector).listview('refresh');
    };

    function generateChapterListItem(book, chapter) {
        var chapterListItem = $('<li class="chapter-listing" chapter-index=' + chapter.index + '><a><h2>' + chapter.name + '</h2></a><div class="progressBar"><div class="progressBarSlider"></div></div></li>');
        chapterListItem.click(function () {
            console.log(this);
            downloadChapterWithCbk(book, chapter, this);
        });
        $(list_selector).append(chapterListItem);
    };
    
    function downloadChapterWithCbk(book, chapter, that) {
        return bookDownloadManager.downloadChapter(
            book,
            chapter,
            function (event) { // move this into a new object
                if (event.lengthComputable) {
                    var percentage = (event.loaded / event.total) * 100;
                    $(that).find('.progressBarSlider').css('width', percentage + '%');
                }
            });
    }

    function getChaptersFromFeed(book_id, callback_func) {
        httpRequestHandler.getXML("https://librivox.org/rss/" + encodeURIComponent(book_id), function (xhr) {
            var xml = $(xhr.response),
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
            callback_func(chapters);
        });
    };
}

function BookDownloadManager(args) {
    var that = this;
    var httpRequestHandler = args.httpRequestHandler;
    var storageManager = args.storageManager;

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

    this.write = function (blob, path) { // should be moved to different object
        var request = storageDevice.addNamed(blob, path);
        if (request) {
            request.onsuccess = function () {
                console.log('wrote: ' + this.result);
            };
        }
    };

    this.getChapterFilePath = function (book_id, chapter_index) {
        return 'librifox/' + book_id + '/' + chapter_index + '.mp3';
    };
}

function BookReferenceManager(args) {
    var args = args || {},
        local_storage = args.localStorage || localStorage,
        that = this;
    this.JSON_PREFIX = 'bookid_';

    this.storeJSONReference = function (book_obj, chapter_obj, path) {
        if (!isValidIndex(book_obj.id)) {
            throw new Error('book_obj.id is not a valid index: ' + book_obj.id);
        }
        var obj = that.loadJSONReference(book_obj.id);
        if (!obj) {
            obj = {
                title: book_obj.title
            };
        }
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

    function applyHelperFunctions(book_ref) {
        book_ref.eachChapter = function (each_fn) {
            Object.keys(book_ref).forEach(function (key) {
                if (isValidIndex(key) && book_ref.hasOwnProperty(key)) {
                    each_fn(book_ref[key], key);
                }
            });
        };
        return book_ref;
    }

    function isValidIndex(index) {
        return /^\d+$/.test(index)
    }
}
var bookReferenceManager = new BookReferenceManager(),
    bookStorageManager = new BookStorageManager({
        storageDevice: lf_getDeviceStorage(),
        referenceManager: bookReferenceManager
    }),
    bookDownloadManager = new BookDownloadManager({
        httpRequestHandler: httpRequestHandler,
        storageManager: bookStorageManager
    }),
    chaptersListGen = new ChaptersListPageGenerator({
        'httpRequestHandler': httpRequestHandler,
        'list_selector': '#chaptersList',
        'header_selector': '#chapterHeader',
        'bookDownloadManager': bookDownloadManager
    });

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
                        ui_state.ref = obj
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
            $(selectors.header_title).text(ui_state.ref.title);
            var $list = $(selectors.list);
            $list.children('li.stored-chapter').remove();
            ui_state.ref.eachChapter(function (chapter_ref) {
                var link = $('<a/>', {
                    class: 'showFullText',
                    text: chapter_ref.name,
                    click: function () {
                        alert('path on filesystem is ' + chapter_ref.path);
                    }
                });
                $('<li/>', {
                    class: 'stored-chapter',
                    html: link
                }).appendTo($list);
            });
            $list.listview('refresh');
        });
    }
}



var ui_state = {},
    storedBooksPageGenerator = new StoredBooksPageGenerator({
        bookReferenceManager: bookReferenceManager,
        ui_state: ui_state
    }),
    storedChaptersPageGenerator = new StoredChaptersPageGenerator({
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

function BookPlayerPageGenerator(args) {
    var args = args || {};

    var dlFullBook = args.selectors.dlFullBook;
    var dlChapter = args.selectors.dlChapter;
    var audioSource = args.selectors.audioSource;

    var bookDownloadManager = args.bookDownloadManager;

    this.generatePage = function (page_args) {
        var page_args = page_args;
        var book_obj = page_args.book;
        var chapter_obj = page_args.chapter;

        $(dlChapter).click(function () {
            bookDownloadManager.downloadChapter(book_obj, chapter_obj);
        });

        $(audioSource).prop("src", chapter_obj.url);
        $(audioSource).on("timeupdate", function () {
            chapter_obj.position = this.currentTime;
        });
    }
}

bookPlayerArgs = {
    'bookDownloadManager': bookDownloadManager,
    'selectors': {
        'dlFullBook': '#downloadFullBook',
        'dlChapter': '#downloadPart',
        'audioSource': '#audioSource',
    }
};
var bookPlayerPageGenerator = new BookPlayerPageGenerator(bookPlayerArgs);

$(document).on("pagecreate", "#homeBook", function (event) {
    if (!appUIState.currentBook) { // selectedBook is undefined if you refresh the app from WebIDE on a chapter list page
        console.warn("Chapters List: selectedBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
        return false;
    }
    bookPlayerPageGenerator.generatePage({
        book: appUIState.currentBook,
        chapter: appUIState.currentChapter
    });
});

var fileManager = new FileManager(lf_getDeviceStorage());
$(document).on("pagecreate", "#homeFileManager", function () {
    $('#deleteAll').click(function () {
        fileManager.deleteAllAppFiles();
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
            storage_device.delete(result.name);
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