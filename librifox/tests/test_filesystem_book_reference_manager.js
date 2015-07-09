describe('FilesystemBookReferenceManager()', function () {
    'use strict';
    describe('#findAllChapters', function () {
        var fbrm,
            fileManager,
            fileManagerSpy,
            settings,
            id3stub,
            
            id3_sample_tags = [ // via LibriVox.org chapter downloads
                {
                    "title": "\u0000Bk1 Ch02\u0000 - The Mail\u0000", // added additional \u0000 characters
                    "album": "A Tale of Two Cities\u0000",
                    "artist": "Charles Dickens\u0000",
                    "year": "\u0000\u0000\u0000\u0000",
                    "v1": {
                        "title": "Bk1 Ch02 - The Mail\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "artist": "Charles Dickens\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "album": "A Tale of Two Cities\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "year": "\u0000\u0000\u0000\u0000",
                        "comment": "Read by Kara Shallenberg (ht",
                        "track": 2,
                        "version": 1.1,
                        "genre": "Speech"
                    },
                    "v2": {
                        "version": [3, 0],
                        "artist": "Charles Dickens\u0000",
                        "album": "A Tale of Two Cities\u0000",
                        "genre": "(101)\u0000",
                        "comments": "Read by Kara Shallenberg (ht",
                        "title": "Bk1 Ch02 - The Mail",
                        "track": "2/45"
                    }
                },
                {
                    "title": "Bk1 Ch03 - The Night Shadows",
                    "album": "A Tale of Two Cities",
                    "artist": "Charles Dickens",
                    "year": "\u0000\u0000\u0000\u0000",
                    "v1": {
                        "title": "Bk1 Ch03 - The Night Shadows\u0000\u0000",
                        "artist": "Charles Dickens\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "album": "A Tale of Two Cities\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "year": "\u0000\u0000\u0000\u0000",
                        "comment": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "track": 3,
                        "version": 1.1,
                        "genre": "Speech"
                    },
                    "v2": {
                        "version": [3, 0],
                        "album": "A Tale of Two Cities",
                        "artist": "Charles Dickens",
                        "genre": "(101)",
                        "track": "3/45",
                        "title": "Bk1 Ch03 - The Night Shadows"
                    }
                },
                {
                    "title": "Test Chapter",
                    "album": "Test Book",
                    "artist": "John Doe",
                    "year": "\u0000\u0000\u0000\u0000",
                    "v1": {
                        "title": "Test Chapter\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "artist": "John Doe\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "album": "Test Book",
                        "year": "\u0000\u0000\u0000\u0000",
                        "comment": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
                        "track": 0,
                        "version": 1.1,
                        "genre": null
                    },
                    "v2": {
                        "version": [3, 0],
                        "artist": "John Doe",
                        "album": "Test Book",
                        "title": "Test Chapter",
                        "genre": "",
                        "comments": ""
                    }
                },
                {
                    v1: {},
                    v2: {}
                } // test how object handles null tags (double check that this is correct)
            ];

        beforeEach(function () {
            fileManager = {
                enumerateFiles: function (args) { 
                    id3_sample_tags.forEach(function () {
                        args.func_each({name: 'path/to/foo.lfa'});
                    });
                }
            };
            fileManagerSpy = sinon.spy(fileManager, 'enumerateFiles');
            
            var index = -1;
            id3stub = sinon.stub(window, 'id3', function (result, fn) {
                setTimeout(function () {
                    fn(undefined, id3_sample_tags[index += 1 % id3_sample_tags.length]);
                }, 4);
            });
            
            settings = {
                getAsync: function (key, callback) {
                    if (key === 'user_folder') {
                        callback('USER_FOLDER_STRING');
                    } else {
                        throw 'Unrecognized key';
                    }
                }
            }
            
            fbrm = new FilesystemBookReferenceManager({
                fileManager: fileManager,
                settings: settings
            });
        });
        afterEach(function () {
            id3stub.restore();
        });
        it('matches only .lfa files', function () {
            var donothing_fileManager = { enumerateFiles: function () {} }
            var fbrm_noaction = new FilesystemBookReferenceManager({
                fileManager: donothing_fileManager,
                settings: settings
            });
            var spy = sinon.spy(donothing_fileManager, 'enumerateFiles');
            fbrm_noaction.findAllChapters();
            var filename_rxp = spy.firstCall.args[0].match;
            
            expect(spy.calledOnce).to.be.true;
            expect('path/to/a.lfa').to.match(filename_rxp);
            expect('path/to/b.mp3').not.to.match(filename_rxp);
            expect('path/to/.lfa').to.match(filename_rxp); // this one DOES match, is it worth fixing so it doesn't?
            
        });
        it('adds parsed id3 data to object', function (done) { // I have no way to tell when findAllChapters is completely finished            
            var times_called = 0;
            fbrm.findAllChapters(function () {
                times_called += 1;
                if (times_called === 4) {
                    expect(fileManagerSpy.calledOnce).to.be.true;
                    var book_ref = fbrm.books.getBook('A Tale of Two Cities');
                    expect(book_ref).to.be.an('object');
                    expect(book_ref.title).to.equal('A Tale of Two Cities');
                    
                    expect(book_ref.chapters[2]).to.be.an('object');
                    expect(book_ref.chapters[3]).to.be.an('object');
                    
                    expect(book_ref.chapters[2]).to.eql({
                        name: 'Bk1 Ch02 - The Mail',
                        path: 'path/to/foo.lfa'
                    });
                    
                    console.log(fbrm.books.untitled[0]);
                    expect(fbrm.books.untitled).property('length', 1);
                    expect(fbrm.books.untitled[0]).property('title', 'Untitled Book');
                    done();
                }
            });
            
        });
    });
});