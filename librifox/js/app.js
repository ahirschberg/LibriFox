window.addEventListener('DOMContentLoaded', function () {
    'use strict';
    //var translate = navigator.mozL10n.get;
});
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
    this.fullBookUrl = json.url_zip_file;
}

function Chapter(args) {
    var title_regex = /^<!\[CDATA\[(.*)\]\]>$/;
    var title_match = title_regex.exec(args.title);
    this.title = stripHTMLTags(title_match[1] || args.title); // if regex doesn't match, fall back to raw string
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
    var list_selector     = args.list_selector;
    var header_selector   = args.header_selector

    this.generatePage = function (book) {
        $(header_selector).text(book.title); // untested, TODO update tests
        
        if (book.chapters) {
            showLocalChapters(book.chapters);
        } else {
            getChaptersFromFeed(book.id, function (chapters) {
                book.chapters = chapters;
                showLocalChapters(book.chapters);
            });
        }
    };

    function showLocalChapters(chapters) {
        $.each(chapters, function (index, chapter) {
            generateChapterListItem(chapter);
        });
        $(list_selector).listview('refresh');
    };

    function generateChapterListItem(chapter) {
        var chapterListItem = $('<li chapter-index=' + chapter.index + '><a href="book.html"><h2>' + chapter.title + '</h2></a></li>');
        chapterListItem.click(function () {
            appUIState.setCurrentChapterByIndex($(this).attr("chapter-index"));
        });
        $(list_selector).append(chapterListItem);
    };

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
                    'title': $title.text(),
                    'url': $enclosure.attr('url')
                });
                chapters.push(chapter);
            });
            callback_func(chapters);
        });
    };
}

var chaptersListGen = new ChaptersListPageGenerator({
    'httpRequestHandler': httpRequestHandler,
    'list_selector': '#chaptersList',
    'header_selector': '#chapterHeader'
});
$(document).on("pagecreate", "#chaptersListPage", function (event) {
    var selectedBook = appUIState.currentBook;
    if (!selectedBook) { // selectedBook is undefined if you refresh the app from WebIDE on a chapter list page
        console.warn("Chapters List: selectedBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
        return false;
    }
    chaptersListGen.generatePage(selectedBook);
});

function BookDownloadManager(args) {
    var that = this;
    var progressSelector = args.progressSelector;
    var httpRequestHandler = args.httpRequestHandler;
    var storageManager = args.storageManager;

    function downloadFile(url, finished_callback) {
        var req_progress_callback;
        var additional_args = {};
        if (progressSelector) {
            req_progress_callback = function (event) {
                if (event.lengthComputable) {
                    var percentage = (event.loaded / event.total) * 100;
                    $(progressSelector).css('width', percentage + '%');
                }
            };
        }
                
        if (progressSelector) {
            additional_args.progress_callback = function () { req_progress_callback.apply(this, arguments) };
        }
        
        httpRequestHandler.getBlob(
            url,
            function (xhr) { finished_callback(xhr.response); }, 
            additional_args);
    }

    this.downloadBook = function (book_obj) {
        console.warn('#downloadBook called - this function will not work until we are able to unzip files.')
        downloadFile(book_obj.fullBookUrl, function (response) {
            storageManager.writeBook(response, book_obj.id);
        });
    }
    this.downloadChapter = function (book_id, chapter_obj) {
        downloadFile(chapter_obj.url, function (response) {
            storageManager.writeChapter(response, book_id, chapter_obj.index);
        });
    }
}

var bookStorageManager = new BookStorageManager({
    storageDevice: navigator.getDeviceStorage && navigator.getDeviceStorage('sdcard')// when karma evals this code, #getDeviceStorage is undefined, causing tests to crash
});
var bookDownloadManager = new BookDownloadManager({
    progressSelector: ".progressBarSlider",
    httpRequestHandler: httpRequestHandler,
    storageManager: bookStorageManager
});

function BookStorageManager(args) {
    var that = this;
    var storageDevice = args.storageDevice;

    this.writeBook = function (blob, book_id) {
        var bookPath = that.getBookFilePath(book_id);
        that.write(blob, bookPath);
    };
    this.writeChapter = function (blob, book_id, chapter_index) {
        var chPath = that.getChapterFilePath(book_id, chapter_index);
        that.write(blob, chPath);
    };

    this.write = function (blob, path) { // should be moved to different object
        var request = storageDevice.addNamed(blob, path);
        if (request) {
            request.onsuccess = function () {
                console.log('wrote: ' + this.result);
            };
        }
    };
    this.getBookFilePath = function (book_id) {
        return 'librifox/' + book_id + '/full.zip'; // will not work until we set up fullbook unzip.
    };
    this.getChapterFilePath = function (book_id, chapter_index) {
        return 'librifox/' + book_id + '/' + chapter_index + '.mp3';
    };
}

function BookPlayerPageGenerator(args) {
    var args = args || {};

    var dlFullBook = args.selectors.dlFullBook;
    var dlChapter = args.selectors.dlChapter;
    var audioSource = args.selectors.audioSource;

    var bookDownloadManager = args.bookDownloadManager;

    this.generatePage = function (page_args) {
        var page_args = page_args || {}; // how should null args be handled? Is it better to do this, or to fail loudly?
        var book_obj = page_args.book;
        var chapter_obj = page_args.chapter;

        $(dlFullBook).click(function () {
            bookDownloadManager.downloadBook(book_obj); // doesn't work
        });

        $(dlChapter).click(function () {
            bookDownloadManager.downloadChapter(book_obj.id, chapter_obj);
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
    }); // is this formatting style better or worse than the regular way?
});

var fileManager = new FileManager();
$(document).on("pagecreate", "#homeFileManager", function () {
    $('#deleteAll').click(function () {
        fileManager.deleteAllAppFiles();
    });
    fileManager.displayAppFiles();
});

function FileManager () {
    var that = this;
    
    this.displayAppFiles = function () {
        var sdcard = navigator.getDeviceStorage('sdcard');
        var times_called = 0;
        var enumeration_cb = function(result) {
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
            storage: sdcard,
            match: /librifox\/.*/,
            func_each: enumeration_cb,
            func_done: done_cb
        });
    }

    this.enumerateFiles = function(args) {
        var storage = args.storage,
            match = args.match,
            func_each = args.func_each,
            func_done = args.func_done,
            func_error = args.func_error;

        var request = storage.enumerate();
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
            func_error && func_error(); // does this work?
        };
    }

    this.deleteAllAppFiles = function () {
        var sdcard = navigator.getDeviceStorage('sdcard');
        var enumeration_cb = function (result) {
            console.log(result.name + ' will be deleted');
            sdcard.delete(result.name);
        }
        that.enumerateFiles({
            storage: sdcard,
            match: /librifox\/.*/,
            func_each: enumeration_cb,
            func_done: function () {that.displayAppFiles();}
        });
    }
}

function SearchResltsPageGenerator(args) {
    var args = args || {};
    var httpRequestHandler = args.httpRequestHandler;
    var selector = args.selector; // #booksList

    this.generatePage = function (search_string) {
        clearResultsElement();
        getSearchJSON(search_string, function (books) {
            if (books) {
                books.forEach(function (book_entry) {
                    var book = new Book({
                        'json': book_entry
                    });
                    bookCache[book.id] = book; // this ends up storing id 3 times (as key, in book object, and in book object json)
                    bookListItem = $('<li book-id="' + book.id + '"><a href="chapters.html"><h2>' + book.title + '</h2><p>' + book.description + '</p></a></li>');
                    bookListItem.click(function () {
                        appUIState.setCurrentBookById($(this).attr("book-id"));
                    });
                    $(selector).append(bookListItem);
                });
                $(selector).listview('refresh');
            } else {
                $(selector).append('<p id="noAvailableBooks">No books found, try simplifying your search.<br/>' +
                    'The LibriVox search API is not very good, so we apologize for the inconvenience.</p>');
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

    function clearResultsElement() {
        $(selector).empty();
    }
}
var searchResultsPageGenerator =
    new SearchResltsPageGenerator({
        'httpRequestHandler': httpRequestHandler,
        'selector': '#booksList'
    });

$("#newSearch").submit(function (event) {
    $("#booksList").empty();
    var input = $("#bookSearch").val();
    searchResultsPageGenerator.generatePage(input);
    return false;
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
            //  xhr.upload.addEventListener("error", transferFailed, false);
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