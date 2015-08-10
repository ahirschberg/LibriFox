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
Book.isValidIndex = function (index) {
    return /^\d+$/.test(index)
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
    'use strict';
    var that = this,
        httpRequestHandler = args.httpRequestHandler,
        fsBookReferenceManager = args.fsBookReferenceManager,
        bookDownloadManager = args.bookDownloadManager,
        selectors,
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
    
    function showFooterAlert(book_id) {
        if ($(selectors.footer_alert).css('display') === 'none') {
            var book = fsBookReferenceManager.getBook(book_id);
            if (book && !book.hidden) {
                $(selectors.footer_alert)
                    .click(function () {
                        stored_chapters_data_handle(book);
                    })
                    .show({
                        complete: function () {
                            var footer_height = $(this).height();
                            if (footer_height) {
                                $(selectors.page).css('padding-bottom', footer_height + 'px');
                            }
                        }
                    });
            }
        }
    }
    
    this.registerEvents = function (_selectors) {
        selectors = _selectors;
        if (!selectors.page) {
            console.warn('Selectors.page is undefined for SearchedBookPageGenerator');
        }
        $(document).on("pagebeforeshow", selectors.page, function (event) {
            console.log('pagebeforeshow called');
            var book = chapter_ui_state.book;
            if (!book) {
                console.warn("Chapters List: book was undefined, which freezes the app.  Did you refresh from WebIDE?");
                return false;
            }
            $(selectors.book_title).text(book.title);
            $(selectors.book_description).text(book.description);

            if (book.chapters) {
                showLocalChapters(book);
            } else {
                getChaptersFromFeed(book.id, function (chapters) {
                    book.chapters = chapters;
                    showLocalChapters(book);
                }, function (err) {
                    console.error('Error getting chapters for ' + book.title, err);
                    var $error_li = $('<li/>').text('Error getting chapters: ' + err.name);
                    $(selectors.list).append($error_li);
                    $(selectors.list).listview('refresh');
                });
            }

            showFooterAlert(book.id);
        });
        
        fsBookReferenceManager.on('change', () => {
            console.log('updating footer alert due to filesystem change.');
            if (chapter_ui_state.book) {
                showFooterAlert(chapter_ui_state.book.id);
            }
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
                error: function () {
                    if (confirm('The file you are trying to download already exists. Delete the old version? ')) {
                        bookDownloadManager.forceDownloadChapter(args) // meta referencing??
                    }
                }
            }
        };
        return bookDownloadManager.downloadChapter(args);
    }

    function getChaptersFromFeed(book_id, callback_func, err_func) {
        httpRequestHandler.getXML("https://librivox.org/rss/" + encodeURIComponent(book_id), function (xhr) {
            try {
                var xml = $.parseXML(xhr.response),
                    chapters = Chapter.parseFromXML(xml);
                callback_func(chapters);
            } catch (err) {
                if (!err.hasOwnProperty('name')) {
                    err.name = 'XMLParseError'; // becuase jQuery doesn't do this for us.
                }
                err_func && err_func(err);
            }
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
        deviceStoragesManager.getStorage().addFile(blob, path).then(function (result) {
            console.log('wrote: ' + result);
            success_fn && success_fn(result);
        }).catch(function (error) {
            console.warn('Failed to write ' + path + ': ', error);
            alert('Failed to write file: ' + error.name);
        });
    };
    
    this.getChapterFilePath = function (book_id, chapter_index) {
        return deviceStoragesManager.downloadsStorageName + APP_DOWNLOADS_DIR + '/' + book_id + '/' + chapter_index + '.lfa';
    };
}

function BookReferenceManager(args) {
    'use strict';
    var args = args || {},
        async_storage = args.asyncStorage,
        fileManager = args.fileManager,
        obj_storage = {},
        that = this,
        JSON_PREFIX = this.JSON_PREFIX = 'bookid_',
        current_jobs = {};
    
    this.obj_storage = obj_storage; // for testing access
    
    this.updateUserData = function (book_id, data_obj) {
        return that.loadBookReference(book_id).then(book_ref => {
            if (!book_ref) {
                book_ref = {};
            }
            if (!data_obj) {
                delete book_ref.user_progress;
            } else {
                book_ref.user_progress = data_obj;
            }
            
            return store_item(JSON_PREFIX + book_id, book_ref);
        });
    }
    
    this.storeChapterReference = function (book_obj, chapter_obj, path, options) {
        options = options || {};
        if (!Book.isValidIndex(book_obj.id)) {
            throw new Error('book_obj.id is not a valid index: ' + book_obj.id);
        }
        return that.loadBookReference(book_obj.id).then(function (obj) {
            console.log('loadBookReference callback evaluated');
            var obj = obj || {};
            obj.title = obj.title || book_obj.title;
            obj.id = obj.id || book_obj.id;

            if (!Book.isValidIndex(chapter_obj.index)) {
                throw new Error('chapter_obj.index is not a valid index: ' + chapter_obj.index);
            }
            obj[chapter_obj.index] = {
                path: path,
                name: chapter_obj.name
            };
            
            obj_storage[JSON_PREFIX + book_obj.id] = obj;
            options.reference_created && options.reference_created(obj);
            
            return store_item(JSON_PREFIX + book_obj.id, obj);
        });
    };
    
    function store_item (key, item) {
        return new Promise(resolve => {
            
            var 
            write_to_storage = function (key, item) {
                async_storage.setItem(key, item, function () {
                    console.log('wrote to asyncStorage:', item);
                    var job = current_jobs[key];
                    var _when_done = job.when_done;
                    job.when_done = undefined;
                    _when_done && _when_done();
                    job.status = 'DONE';
                    console.log('DONE! job store is now ' + JSON.stringify(current_jobs))
                    
                    resolve(item);
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
            
        }).catch(e => {
            console.warn('Caught error in BookReferenceManager#store_item internal function', e);
            throw e;
        });
    }

    this.loadBookReference = function (book_id, load_callback, prefix) {
        if (!prefix && prefix !== '') { // allow null prefix, but default to JSON_PREFIX. this is bad behavior :(
            prefix = JSON_PREFIX;
        }
        var os_book_ref = obj_storage[prefix + book_id];
        return new Promise(resolve => {
            if (os_book_ref) {
                resolve(os_book_ref);
            } else {
                async_storage.getItem( (prefix + book_id), function (obj) {
                    console.log('got obj from async storage', obj)
                    if (obj_storage[prefix + book_id]) { // if the object has loaded since the async was called
                        resolve(obj_storage[prefix + book_id]);
                    } else {
                        obj_storage[prefix + book_id] = obj;
                        resolve(obj);
                    }
                });
            }
        }).then(book_ref => {
            if (load_callback) {
                load_callback(book_ref);
            }
            return book_ref;
        }).catch(e => {
            if (load_callback) {
                console.error(e);
            }
            throw e;
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
            return id3_parser.parse(blob).catch(e => {
                console.warn('Encountered error ', e)
                return undefined;
            }).then(metadata => {
                if (metadata) {
                    success(metadata);
                } else {
                    success();
                }
            });
        }
    }
    
    function getLibriVoxInfoFromPath(obj) {
        var path;
        if (typeof obj === 'string') {
            path = obj;
        } else {
            path = obj.name;
        }
        return path.match(inapp_download_path_matcher);
    }
    
    return {
        getParser: getParser,
        getLibriVoxInfoFromPath: getLibriVoxInfoFromPath
    };
})()

function MediaManager() {
        'use strict';
        var db,
            event_manager,
            available = false;

        db = new MediaDB("sdcard", MediaDBMetadataParser.getParser(ID3Parser), {
            includeFilter: /[^\.]+\.lfa$/,
            version: 1
        });
        db.addEventListener('created', createdEvent);
        db.addEventListener('deleted', deletedEvent);
        db.addEventListener('ready', (event) => {
            console.log('MediaDB has become available', event);
            available = true;
        });
        db.addEventListener('unavailable', (event) => {
            console.log('MediaDB has become unavailable', event);
            available = false;
        });

        event_manager = new EventManager();
        event_manager.registerEvents('created', 'deleted');

        this.db = db;

        function createdEvent(event) {
            console.log('created', event);
            event_manager.trigger('created', event);
        }

        function deletedEvent(event) {
            console.log('deleted', event);
            event_manager.trigger('deleted', event);
        }

        this.on = function (eventName, callback) {
            event_manager.on(eventName, callback);
        }
        this.off = function (eventName) {
            event_manager.off(eventName);
        }

        this.enumerate = function (callback) {
            db.enumerate((item) => {
                callback(item);
            });
        }

        Object.defineProperty(this, 'available', {
            get: () => available
        })

        this.__debug__deleteDatabase = function () {
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
        }

function FilesystemBookReferenceManager(args) {
    'use strict';
    
    var mediaManager = args.mediaManager,
        deviceStoragesManager = args.deviceStoragesManager,
        bookReferenceManager = args.bookReferenceManager,
        event_manager = new EventManager(),
        bookFactory = new BookFactory(deviceStoragesManager.getStorage()),
        books = {
            store: {},
            setChapter: function (store_info, chapter_info) {
                var new_book = false,
                    obj = this.store[store_info.id];
                if (!obj) {
                    new_book = true;

                    obj = bookFactory.getBlankBook();
                    obj.title = store_info.book_title;
                    obj.id = store_info.id;
                }
                obj.hidden = false;
                
                if (Book.isValidIndex(store_info.index)) {
                    obj[store_info.index] = chapter_info;
                } else {
                    obj.noindex = obj.noindex || [];
                    obj.noindex.push(chapter_info);
                }
                
                if (store_info.hasOwnProperty('user_progress')) {
                    obj.user_progress = store_info.user_progress;
                }
                
                this.store[store_info.id] = obj;
                
                return new_book;
            },
            forEach: function (each_ref) {
                Object.keys(this.store).forEach((key) => {
                    each_ref(this.store[key]);
                })
            }
        };
    
    this.getBook = function (id) {
        return books.store[id];
    }
    
    this.on = function (event_name, callback) {
        event_manager.on(event_name, callback);
    }
    this.off = function (event_name) {
        event_manager.off(event_name);
    }
    
    event_manager.registerEvent('change');
    mediaManager.on('created', event => {
        addChapters(event.detail).then(() => {
            event_manager.trigger('change', books)
        }).catch(e => {
            console.error('Caught error in FSBRM file created event:', e, '\n', e.stack)
        });
    });
    
    mediaManager.on('deleted', event => {
        var paths = event.detail;
        paths.forEach(path => {
            books.forEach(ref => {
                ref.eachChapter(chapter => {
                    if (chapter.path === path) {
                        console.log('deleting chapter with path: ' + chapter.path);
                        ref.deleteChapter(chapter);
                    }
                });
            });
        });
        event_manager.trigger('change', books);
    });
    
    function standardizeItem(mediadb_item) {
        console.log('item: ', mediadb_item)
        var path_match = MediaDBMetadataParser.getLibriVoxInfoFromPath(mediadb_item.name);
        if (path_match) {
            var book_id = parseInt(path_match[1], 10),
                chapter_index = parseInt(path_match[2], 10);
            return bookReferenceManager.loadBookReference(book_id).then(book_ref => {
                var metadata = mediadb_item.metadata || {};
                var obj = {
                    store_info: {
                        id: book_id,
                        index: chapter_index,
                        book_title: (book_ref && book_ref.title) ||
                                    metadata.album ||
                                    'Book id: ' + book_id,
                        user_progress: book_ref && book_ref.user_progress
                    },
                    chapter_info: {
                        name: (book_ref &&
                                book_ref[chapter_index] &&
                                book_ref[chapter_index].name) ||
                            metadata.title ||
                            mediadb_item.name,
                        path: mediadb_item.name
                    }
                }
                return obj;
            });
        } else {
            var metadata = mediadb_item.metadata || {};
            var obj = {
                store_info: {
                    book_title: metadata.album || 'Untitled',
                    id: metadata.album || -1,
                    index: metadata.tracknum
                },
                chapter_info: {
                    name: metadata.title || mediadb_item.name,
                    path: mediadb_item.name
                }
            };
            return bookReferenceManager.loadBookReference(obj.store_info.id).then(fs_book_ref => {
                if (fs_book_ref) {
                    obj.store_info.user_progress = fs_book_ref.user_progress;
                }
                return obj;
            });
        }
    }
    
    function addChapters (collection) {
        var promise = Promise.resolve();
        collection.forEach(each_ref => {
            promise = promise.then(() => {
                return standardizeItem(each_ref)
            }).then(to_store => {
                books.setChapter(to_store.store_info, to_store.chapter_info);
            });
        });
        return promise;
    }
    
    this.dynamicLoadBooks = (each_book_fn) => {
        books.store = {};
        var p = Promise.resolve(),
            all_enumerated_deferred = {};
        all_enumerated_deferred.promise = new Promise((resolve, reject) => {
            all_enumerated_deferred.resolve = resolve;
            all_enumerated_deferred.reject = reject;
        });
        if (mediaManager.db.state !== 'ready' && mediaManager.db.state !== 'enumerable') {
            mediaManager.db.addEventListener('enumerable', () => {
                all_enumerated_deferred.resolve(this.dynamicLoadBooks(each_book_fn));
            })
        } else { // trying to get errors to output here was a nightmare,
                 // maybe I'm not using promises correctly?
            mediaManager.enumerate(item => {
                console.log('Got item in #enumerate:', item);
                p = p.then(() => {
                    console.log('Got item in #then:', item);
                    if (item === null) {
                        all_enumerated_deferred.resolve(books);
                    } else {
                        return standardizeItem(item).then(to_store => {
                            if (books.setChapter(to_store.store_info, to_store.chapter_info)) {
                                var stored_book = this.getBook(to_store.store_info.id);
                                each_book_fn && each_book_fn(stored_book);
                            }
                        })
                    }
                    
                }).catch(e => {
                    all_enumerated_deferred.reject(e);
                    throw e;
                });
            });
        }
        return all_enumerated_deferred.promise;
    }
}

function BookFactory (fileManager) {
    'use strict';    
    
    var book_prototype = {
        deleteChapter: function (chapter_to_del, options) {
            var path;
            if (typeof chapter_to_del === 'string') {
                path = chapter_to_del;
            } else {
                path = chapter_to_del.path;
            }
            var options = options || {};
            this.eachChapter((chapter, index, noindex_arr) => {
                if (chapter.path === path) {
                    if (noindex_arr) { 
                        noindex_arr.splice(index, 1);
                    } else {
                        delete this[index];
                    }
                    
                    if (options.delete_on_disk) {
                        fileManager.deleteFile(chapter.path).then(() => {
                            options.file_delete_success && options.file_delete_success();
                        }).catch(e => {
                            console.warn('Error deleting file from disk:', e);
                            options.file_delete_error && options.file_delete_error(e)
                        })
                    } else {
                        console.log('not deleting from disk');
                    }
                    
                    if (this.numChapters === 0) {
                        this.hidden = true;
                    }
                    return true;
                }
            });
        },
        eachChapter: function (each_fn) {
            var keys = Object.keys(this),
                length = keys.length,
                i = 0;
            var stop = keys.some((key) => {
                if (Book.isValidIndex(key) && this.hasOwnProperty(key)) {
                    return each_fn(this[key], parseInt(key, 10), null);
                }
            });
            if (!stop) {
                this.noindex && this.noindex.some(each_fn);
            }
        },
        get numChapters() {
            var count = 0;
            this.eachChapter(() => {
                ++count;
            });
            return count;
        }
    };
    
    this.getBlankBook = function () {
        return Object.create(book_prototype);
    }
}

function StoredBooksListPageGenerator(args) {
    "use strict";
    var that = this,
        fsReferenceManager = args.fsBookReferenceManager,
        selectors,
        stored_chapters_data_handle = args.stored_chapters_data_handle,
        player = args.player;

    fsReferenceManager.on('change', (books) => {
        console.log('updating books ui list due to filesystem change', books);
        refreshList(books);
    })
    
    this.registerEvents = function (_selectors) {
        selectors = _selectors;
        if (!selectors.page) {
            console.warn('Selectors.page is falsy (undefined?), this causes the page event to be registered for all pages');
        }
        $(document).on('pagebeforeshow', selectors.page, function () {            
            if (player.getCurrentInfo()) {
                $('.player-shortcut-footer').show();
            } else {
                $('.player-shortcut-footer').hide();
            }
        });
        $(document).on('pagecreate', selectors.page, function () {
            var $list = $(selectors.list);
            $list.children('li.stored-book').remove();
            fsReferenceManager.dynamicLoadBooks(function (book) {
                if (!book.hidden) {
                    createListItem(book)
                        .appendTo($list);
                    $list.listview('refresh');
                }
            }).catch(e => console.error(e));
        });
    };
    
    function refreshList(collection) {
        var $list = $(selectors.list);
        $list.children('li.stored-book').remove();
        collection.forEach(book => {
            if (!book.hidden) {
                createListItem(book)
                    .appendTo($list);
                $list.listview('refresh');
            }
        });
    }
    
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
            
            var user_progress = ui_state.book.user_progress,
                user_progress_viable = false,
                storage_devices = [];
            
            ui_state.book.eachChapter(function (chapter_ref) {
                if (user_progress && !user_progress_viable) {
                    user_progress_viable = (chapter_ref.path === user_progress.path);
                }
                storage_devices.push(storageFromPath(chapter_ref.path));
                createListItem(chapter_ref, user_progress).bind('taphold', function () {
                    var that = this;
                    $(selectors.book_actions_popup).popup('open', {
                        transition: 'pop',
                        positionTo: that // neat, positions over the held element!
                    });
                    $(selectors.book_actions_popup + ' .delete_chapter').click(function () {
                        ui_state.book.deleteChapter(chapter_ref.path, {
                            delete_on_disk: true,
                            file_delete_success: function () {
                                $(that).remove();
                                $(selectors.page + ' ul').listview('refresh');
                                if (ui_state.book.numChapters === 0) {
                                    $.mobile.back();
                                }
                            },
                            file_delete_error: function (error) {
                                alert('Error deleting file: ' + error.message);
                            }
                        });
                        $(selectors.book_actions_popup).popup('close');
                    });
                }).appendTo($list);
            });
            var $resume_progress;
            if (user_progress_viable) { // if the user progress still matches a chapter path
                $(selectors.contine_playback_button)
                    .click(function () {
                        player_data_handle(
                            new PlayerInfo(ui_state.book, user_progress), {
                                position: user_progress.position
                            }
                        )
                    })
                    .show();
            } else {
                $(selectors.contine_playback_button).hide();
            }
            
            // display to the user how many files are on each storage device
            var string_arr = [], 
                frequency = unique_frequency(storage_devices);
            
            Object.keys(frequency).forEach(storage_device => {
                var num_chapters = frequency[storage_device];
                string_arr.push(storage_device + ': ' + num_chapters + ' file' + (num_chapters === 1 ? '' : 's'));
            });
            $(selectors.storage_device_info).text(string_arr.join(', '));
            
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
    
    function storageFromPath(path) {
        var match = path.match(/^\/*(sdcard[^\/]*)/);
        if (match) {
            return match[1];
        } else {
            return 'Unknown storage';
        }
    }
    
    // must be an array of objects that can be properties (Strings, numbers)
    function unique_frequency(arr) {
        var uniques = {};
        arr.forEach(function (e, i) {
            var count = uniques[e] || 0
            uniques[e] = ++count;
        });
        
        return uniques;
    }
    
    function createListItem(chapter_ref, user_progress) {
        var link = $('<a/>', {
            'class': 'showFullText',
            href: 'player.html',
            text: chapter_ref.name
        });
        
        if (user_progress && chapter_ref.path === user_progress.path) {
            link.text(Player.getProgressDisplayText(chapter_ref.path) + link.text())
                .click(function () {
                    player_data_handle(
                        new PlayerInfo(ui_state.book, user_progress), {
                            position: user_progress.position,
                        }
                    )
                });
        } else {
            link.click(function () {
                player_data_handle(new PlayerInfo(ui_state.book, chapter_ref));
            });
        }
        var $chapter_li = $('<li/>', {
            'class': 'stored-chapter',
            html: link
        });
        
        return $chapter_li;
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
    function EventManager () {
        this.events = {};
    }
    var namespace_rxp = /([^\.]*)(?:\.(.*))?/

    EventManager.prototype.registerEvent = function (eventName) {
        if (arguments.length > 1) {
            console.error('Wrong number of arguments!');
        }
        var event = new Event(eventName);
        this.events[eventName] = event;
    };
    
    EventManager.prototype.registerEvents = function () {
        var args = argumentsToArray(arguments),
            that = this;
        args.forEach(function (eventName) {
            that.registerEvent(eventName);
        });
    }

    EventManager.prototype.trigger = function (eventName, eventArgs) {
        this.events[eventName].callbacks.forEach(function (callback_obj) {
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
        };
    
    /*
     * Usage:
     *     #off('eventName') -> removes all callbacks for event with matching name
     *     #off('eventName.namespace') -> removes all callbacks with matching namespace for event with matching name 
     *     #off('*.namespace) -> removes callbacks with matching namespace for all events
     */
    EventManager.prototype.off = function (event_string) {
        var getEventCallbacks = (key => {
            return this.events[key].callbacks;
        });
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
        delete_progress(old_info);
    });
    
    var write = function (curr_info) { // curr_info is an optional argument
        var curr_info = curr_info || player.getCurrentInfo();
        lastPosition = player.position() || 0;
        
        if (curr_info) {
            console.log('writing ', curr_info)
            var info_obj = {
                path: curr_info.chapter.path,
                name: curr_info.chapter.name,
                position: lastPosition
            };
            referenceManager.updateUserData(curr_info.book.id, info_obj);
            player.getCurrentInfo().book.user_progress = info_obj;
            
        } else {
            console.log('no player info, nothing to write.');
        }
    },
        delete_progress = function (old_info) {
            referenceManager.updateUserData(old_info.book.id, null);
            old_info.book.user_progress = null;
        }
}

function Player(args) {
    "use strict";
    var audio_element,
        create_object_url_fn = args.createObjectURL || URL.createObjectURL,
        fileManager = args.fileManager,
        player_options,
        current_info,
        event_manager = new EventManager(),
        that = this;
    
    function onMetadataLoad () {
        event_manager.trigger('loadedmetadata');
        player_options.load_metadata && player_options.load_metadata.apply(this, arguments);
    }
    function onLoad () {
        
        if (isFinite(player_options.desired_position) && player_options.desired_position >= 0) {
            that.position(player_options.desired_position);
            delete player_options.desired_position;
        }
        event_manager.trigger('loadeddata');
        
        if (player_options.autoplay) {
            that.play();
        }
    }
    function onEnded () {
        event_manager.trigger('ended');
        player_options.ended && player_options.ended.apply(this, arguments);
    }
    function onTimeUpdate () {
        event_manager.trigger('timeupdate');
        player_options.timeupdate && player_options.timeupdate.apply(this, arguments);
    }
    function onPlayerError (event) {
        if (!event.target.src.match(/\/undefined$/)) { // if the src wasn't explicitly set to undefined
            console.warn('Player error:', event);
        }
    }
    function onFileLoadError (path, error) {
        var error_str;
        if (that.getCurrentInfo()) {
            error_str = 'Error loading chapter "' +
                        that.getCurrentInfo().chapter.name +
                        '" with path ' + that.getCurrentInfo().chapter.path + ':'
        } else if (path) {
            error_str = 'Error loading file from path ' + path
        } else {
            error_str = 'Something went wrong while loading audio into the player.'
        }
        error_str += ' ' + error.name
        console.error(error_str);
        event_manager.trigger('loaderror', error_str);
    }
    
    event_manager.registerEvents('loadedmetadata', 'loadeddata', 'play', 'pause', 'timeupdate', 'ended', 'finishedqueue', 'loaderror');
    
    this.on = function (eventName, callback) {
        event_manager.on(eventName, callback);
    }
    this.off = function (eventName) {
        event_manager.off(eventName);
    }
    
    this.queueBook = function (player_info, options) {
        current_info = player_info;
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
        if (player_info.chapter) {
            that.playFromPath(player_info.chapter.path, options);
        } else {
            console.warn('player_info.chapter was undefined, could not play.');
        }
    }
    
    this.next = function () {
        event_manager.trigger('ended');
        if (current_info) {
            var next = current_info.next();
            if (next) {
                that.playFromPath(next.path, player_options);
            } else {
                console.log('Ending playback, no next chapter.');
                audio_element.src = undefined;
                audio_element.load();
                var old_info = current_info;
                current_info = undefined;
                event_manager.trigger('finishedqueue', old_info);
            }
        } else {
            console.warn('Could not go to next track, nothing in queue');
        }
        
    }
    
    this.playFromPath = function (path, options) {
        player_options = options || {};
        fileManager.getFileFromPath(
            path,
            function (file) {
                console.log(file.type, file);
                getAudioElement().src = create_object_url_fn(file);
            }, error => {
                onFileLoadError(path, error);
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
            audio_element.addEventListener('error', onPlayerError);
        }
        
        return audio_element
    }
    this.getAudioElement = getAudioElement;
    
    this.getCurrentInfo = function () {
        if (!current_info) {
            return null;
        } else {
            return current_info.info_obj;
        }
    }
    
    // check if path from user progress is currently playing, paused, or stored
    // assumes user storage pointing to path is checked elsewhere
    Player.getProgressDisplayText = (path) => {
        if (this.getCurrentInfo() === null || path !== this.getCurrentInfo().chapter.path) {
            return '\u27A4'; // stored (arrowhead)
        } else {
            if (this.paused()) {
                return '\u275A\u275A ' // pause
            } else {
                return '\u25BA ' // play
            }
        }
    };
}

function PlayerInfo(book, chapter_to_play) {
    'use strict';
    this.book = book;
    this.chapter = chapter_to_play;
    
    this.next = function () {
        var grab_next_chapter = false,
            grabbed_chapter = null;
        book.eachChapter(_chapter => {
            if (grab_next_chapter) {
                grabbed_chapter = _chapter;
                this.chapter = _chapter;
                return true;
            }
            grab_next_chapter = (this.chapter.path === _chapter.path);
        });
        
        return grabbed_chapter;
    }
    
    Object.defineProperty(this, 'info_obj', {
        get: () => ({
            book: this.book,
            chapter: this.chapter,
            equals: function (other_obj) {
                return this.book.id === other_obj.book.id &&
                    this.chapter.path === other_obj.chapter.path
            }
        })
    })
}

function BookPlayerPageGenerator(args) {
    "use strict";
    var player_context,
        fileManager = args.fileManager,
        player = args.player,
        that = this;
    
    this.getDataHandle = function () {
        return function (playerInfo, options) {
            player_context = {};
            player_context.playerInfo = playerInfo;
            if (options) {
                player_context.position = options.position;
            }
        }
    }

    this.registerEvents = function (selectors) {
        var page = selectors.page;
        $(document).on("pagebeforeshow", selectors.page, function (event) {
            var controls = selectors.controls;
            if (player_context) {
                if (!player.getCurrentInfo() ||  // if nothing is playing 
                                                 // OR
                    (player.getCurrentInfo() &&  // if chapter playing doesn't match chapter  
                        !player.getCurrentInfo() // requested via player_context...
                        .equals(player_context.playerInfo.info_obj))
                    
                ) {                              // then queue the book
                    var options;
                    if (player_context.position) {
                        options = {
                            desired_position: player_context.position
                        };
                    }
                    player.queueBook(player_context.playerInfo, options);
                    player_context = undefined; // delete player context and use player.getCurrentInfo()
                } else {
                    player.play();
                }
            } else if (player.getCurrentInfo()) {
                console.log('Player.html: no player_context, falling back on player.getCurrentInfo()');
            } else {
                console.warn('Tried to load player.html with no player_context or player.getCurrentInfo()');
                return false;
            }

            updateUIandContext(selectors, controls);
            
            var updateTimeSlider = function () {
                $(concatSelectors(controls.container, controls.position)).val(player.positionPercent());
                $(concatSelectors(controls.container, controls.position)).slider('refresh');
                $(concatSelectors(controls.container, controls.position_text)).text(player.prettifyTime(player.position()));
            };
            
            player.on('timeupdate.player-html', updateTimeSlider);
            updateTimeSlider(); // in case player is paused when loaded
            
            player.on('loaderror.player-html', function (error_str) {
                alert(error_str);
                $.mobile.back();
            })
            
            player.on('loadeddata.player-html', function () {
                updateUIandContext(selectors, controls);
            });
            
            var 
            playingButtonText = function () {
                $(concatSelectors(controls.container, controls.play)).text('Pause');
            },
            pausedButtonText = function () {
                $(concatSelectors(controls.container, controls.play)).text('Play');
            };
            
            player.on('play.player-html', playingButtonText);
            player.on('pause.player-html', pausedButtonText);
            
            if (!player.paused()) {
                playingButtonText();
            } else {
                pausedButtonText();
            }
            
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
            player.off('*.player-html'); // remove all player-html namespaced events
        });
    };
    
    function updateUIandContext (selectors, controls) {
        if (player.getCurrentInfo()) {
            $(selectors.book_title).text(player.getCurrentInfo().book.title);
            $(selectors.chapter_title).text(player.getCurrentInfo().chapter.name);
            
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
    
    function generateDefaultSettings () {
        return {};
    }
    
    this.set = function (key, value) {
        return new Promise(resolve => {
            this.get(st_settings_key).then(() => {
                settings[key] = value;

                async_storage.setItem(st_settings_key, settings, () => {
                    resolve(settings);
                });
            })
        })        
    };
    this.get = function (key) {
        return new Promise(resolve => {
            if (settings) {
                resolve(settings[key]);
            } else {
                async_storage.getItem(st_settings_key, _settings => {
                    settings = _settings || generateDefaultSettings();
                    resolve(settings[key]);
                });
            }
        });
    };
}

function SettingsPageGenerator(args) {
    var settingsManager = args.settingsManager,
        deviceStoragesManager = args.deviceStoragesManager;
    
    this.registerEvents = function (selectors) {
        var folder_path_form = selectors.folder_path_form;
        
        if (!selectors.page) {
            console.warn('settings_page selector is falsy! this is probably not what you meant to do.');
        }
        
        $(document).on('pagecreate', selectors.page, function () {            
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
    var settingsManager = args.settingsManager,
        downloads_storage_index,
        downloads_storage_name,
        fileManager = args.fileManager,
        nav = args.navigator || navigator;
    
    settingsManager.get('downloads_storage_device_index').then(value => {
        this.setDownloadsDeviceByIndex(value || 0);
    });
    
    this.setDownloadsDeviceByIndex = function (index) {
        if (isFinite(index) && Math.floor(index) == index) {
            settingsManager.set('downloads_storage_device_index', index);
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
        return fileManager;
    }
    
    this.eachDevice = function (func_each) {
        nav.getDeviceStorages('sdcard').forEach(func_each);
    }
}

function FileManager(args) {
    var that = this,
        storage_device = args.storage_device,
        mediaManager = args.mediaManager;
    
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
        var deferred = {};
        deferred.promise = new Promise((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
        });
        
        if (!mediaManager.available) {
            var error = {
                name: 'The storage device is not currently available. Has it been mounted as a USB device or removed?'
            }
            deferred.reject(error);
        } else {
            var req = storage_device.addNamed(blob, filepath);
            req.onsuccess = function () {
                deferred.resolve(this.result);
            }
            req.onerror = function () {
                deferred.reject(this.error);
            }
        }
        
        return deferred.promise;
    };
    
    this.deleteFile = function (filepath) {
        return new Promise(function (resolve, reject) {
            var req = storage_device.delete(filepath);
            req.onsuccess = function () {
                console.log(this, arguments);
                resolve(this.result)
            }
            req.onerror = function () {
                reject(this.error)
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
            error && error(this.error);
        };
    }
    
    this.mozStorageDevice = storage_device;
}

function SearchResultsPageGenerator(args) {
    'use strict';
    var httpRequestHandler = args.httpRequestHandler,
        sr_chapters_data_handle = args.sr_chapters_data_handle,
        resultsCache = {},
        selectors,
        field,
        that = this;

    this.registerEvents = function (_selectors) {
        selectors = _selectors;
        
        $(document).on("pagecreate", selectors.page, function (event) {
            $(selectors.form).submit(function (event) {
                $(selectors.results_list).empty();
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
            $(selectors.settings_popup + ' .search-by-id').click(function () {
                field = 'id';
                $(selectors.form + ' input').attr('placeholder', 'Enter a book\'s LibriVox id');
                $(selectors.settings_popup).popup('close');
            });
        });
    }

    this.displayResults = function (search_string) {
        $(selectors.results_list).empty();
        getSearchJSON(search_string, function (books) {
            if (books) {
                $(selectors.no_results_msg).hide();
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
                    }).appendTo(selectors.results_list);
                });
                $(selectors.results_list).listview('refresh');
            } else {
                $(selectors.no_results_msg).show();
            }
        });
        
        if (search_string.toLocaleLowerCase().startsWith('the ')) {
            setTimeout(() => {
                $('#search-the-warning').popup('open', {
                    positionTo: 'window',
                    transition: 'pop'
                });
            }, 500) // delay to give the keyboard time to retract.
            
        }
    }

    function getSearchJSON(search_string, callback_func) {
        var lv_url = generateBookUrl(search_string, field);
        httpRequestHandler.getJSON(
            lv_url,
            function (xhr) {
                callback_func(xhr.response.books);
            },
            {
                error_callback: function () {
                    alert('Error loading search results.');
                    console.warn('Could not load search results from ' + lv_url);
                }
            }
        );
    }

    function generateBookUrl(search_string, field) {
        var sanitized_field = field,
            string_for_url = encodeURIComponent(search_string.trim());
        switch(field) {
            case 'title':
            case 'author':
                sanitized_field = field + '/^'; // the ^ prepending the string causes it to be a search rather than an exact lookup
                break;
            case 'id':
                sanitized_field = field + '/';
                break;
            case undefined: 
                sanitized_field = 'title/^';
                break;
            default:
                console.warn('field ' + field + ' is not valid');
                break;
        }        
        return "https://librivox.org/api/feed/audiobooks/" + sanitized_field + string_for_url + "?&format=json";
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
// by checking if FXOS filesystem function is defined
if (typeof navigator.getDeviceStorage === 'function') {
    LazyLoader.load(['js/lib/async_storage.js', 'js/lib/mediadb.js'], () => {
        createApp()
    });
}

function createApp () {
    'use strict';
    
    var // define objects for page generation and background behavior
    settingsManager = new SettingsManager({
        asyncStorage: asyncStorage
    }),
    mediaManager = new MediaManager(),
    fileManager = new FileManager({
        storage_device: navigator.getDeviceStorage('sdcard'),
        mediaManager: mediaManager
    }),
    httpRequestHandler = new HttpRequestHandler(),
    player = new Player({
        fileManager: fileManager
    }),
    deviceStoragesManager = new DeviceStoragesManager({
        settingsManager: settingsManager,
        fileManager: fileManager
    }),
    bookReferenceManager = new BookReferenceManager({
        asyncStorage: asyncStorage,
        fileManager: fileManager
    }),
    bookStorageManager = new BookStorageManager({
        deviceStoragesManager: deviceStoragesManager,
        referenceManager: bookReferenceManager
    }),
    fsBookReferenceManager = new FilesystemBookReferenceManager({
        deviceStoragesManager: deviceStoragesManager,
        mediaManager: mediaManager,
        bookReferenceManager: bookReferenceManager
    }),
    playerProgressManager = new PlayerProgressManager({
        player: player,
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
        bookDownloadManager: bookDownloadManager,
        fsBookReferenceManager: fsBookReferenceManager,
        stored_chapters_data_handle: storedBookPageGenerator.getDataHandle()
    }),
    searchResultsPageGenerator = new SearchResultsPageGenerator({
        httpRequestHandler: httpRequestHandler,
        sr_chapters_data_handle: searchedBookPageGenerator.getDataHandle()
    }),
    storedBooksListPageGenerator = new StoredBooksListPageGenerator({
        bookReferenceManager: bookReferenceManager,
        fsBookReferenceManager: fsBookReferenceManager,
        stored_chapters_data_handle: storedBookPageGenerator.getDataHandle(),
        player: player
    }),
    settingsPageGenerator = new SettingsPageGenerator({
        settingsManager: settingsManager,
        deviceStoragesManager: deviceStoragesManager
    });
    
    // register page events
    storedBooksListPageGenerator.registerEvents({
        list: '#stored-books-list',
        page: '#storedBooksList',
    });
    storedBookPageGenerator.registerEvents({
        header_title: '.book-title',
        list: '#stored-chapters-list',
        page: '#storedBookPage',
        book_actions_popup: '#chapterActionsMenu',
        contine_playback_button: '.continue-playback',
        storage_device_info: '.ch-storage-device'
    });
    bookPlayerPageGenerator.registerEvents({
        page: '#bookPlayer',
        header: '.player-header',
        book_title: '.player-book-title',
        chapter_title: '.player-chapter-title',
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
        results_list: '#results-listing',
        settings_popup: '#search-settings',
        no_results_msg: '.no-available-books'
    });
    searchedBookPageGenerator.registerEvents({
        page: '#searchedBookPage',
        list: '.searched-chapters-list',
        book_title: '.book-title-disp',
        book_description: '.book-desc-disp',
        footer_alert: '#stored-chapters-shortcut-footer'
    });
    settingsPageGenerator.registerEvents({
        page: '#mainSettings',
        folder_path_form: '#user-folder-form'
    });
}