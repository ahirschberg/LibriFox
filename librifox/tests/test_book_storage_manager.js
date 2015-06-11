describe('BookStorageManager()', function () {
    var bsm,
        storageDevice,
        storageMock,
        store,
        ls_proto;

    before(function () {
        storageDevice = {
            addNamed: function (blob, path) {}
        };

        ls_proto = {
            getItem: function (key) {
                return store[key] || null;
            },
            setItem: function (key, str) {
                store[key] = str;
            }
        };
    });
    
    beforeEach(function () {
        // regenerate store and storageMock for each test
        store = Object.create(ls_proto);
        bsm = new BookStorageManager({
            storageDevice: storageDevice,
            localStorage: store
        });
        
        store[bsm.JSON_PREFIX + 9999] = JSON.stringify({
            0: {
                path: 'path1/to',
                name: 'Introduction'
            },
            title: BOOK_OBJECT.title
        });
        storageMock = sinon.mock(storageDevice);
    });

    describe('#writeChapter()', function () {
        it('should generate chapter path via #getChapterFilePath and write to file system', function () {
            storageMock.expects('addNamed').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/0.mp3');
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, CHAPTER_OBJECT);
            storageMock.verify();
        });
    });
    describe('#write()', function () {
        it('should write the specified object to the filesystem', function () {
            storageMock.expects('addNamed').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/01.mp3');
            bsm.write(WEB_RESP.audio_blob, 'librifox/1234/01.mp3');
            storageMock.verify();
        });
    });
    describe('#loadJSONReference()', function () {
        it('loads book_reference from local_storage', function () {
            var book_ref = bsm.loadJSONReference(9999);
            expect(book_ref).to.have.property(0);
                        
            expect(book_ref).to.have.property('title', BOOK_OBJECT.title);
        });
        it('adds helper functions to object', function () {
            var book_ref = bsm.loadJSONReference(9999);
            expect(book_ref).property('eachChapter').to.be.a('function');
        });
    });
    describe('#storeJSONReference', function () {
        it('writes to localstorage', function () {
            var fake_path = 'path/to/file',
                mock_book = {
                    id: 1111
                },
                mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }

            bsm.storeJSONReference(mock_book, mock_chapter, fake_path);
            var ch1_ref = bsm.loadJSONReference(1111)[1];
            expect(ch1_ref).to.have.property('path', fake_path);
            expect(ch1_ref).to.have.property('name', 'Chapter 1');
        });
        it('adds a title property if the entry doesn\'t already exist', function () {
            var fake_ch_index = 1,
                mock_book = {
                    id: 1111,
                    title: 'this is a title'
                };

            bsm.storeJSONReference(mock_book, CHAPTER_OBJECT, 'path/to/file');
            expect(bsm.loadJSONReference(1111)).to.have.property('title', mock_book.title);
        });
        it('appends new keys if object already exists', function () {
            var mock_book = {
                id: 9999
            };
            var mock_chapter = {
                index: 1,
                name: 'Chapter 1'
            }
            bsm.storeJSONReference(mock_book, mock_chapter, 'path2/to');
            var stored = bsm.loadJSONReference(9999);
            expect(stored[0]).to.be.a('object');
            expect(stored[1]).to.be.a('object');
        });
        it('stores indexed chapter references', function () {
            
            var book_ref = bsm.loadJSONReference(9999),
                ch0_ref = book_ref[0];
            expect(ch0_ref).to.have.property('path', 'path1/to');
            expect(ch0_ref).to.have.property('name', 'Introduction');
        });
    });
    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            expect(bsm.getChapterFilePath(1234, 2)).to.equal('librifox/1234/2.mp3');
        });
    });
    describe('#eachReference()', function () {
        it('takes a function and passes it each book key in local_storage', function () {
            store['abcdef'] = {0: {path: 'bad'}};
            bsm.storeJSONReference(BOOK_OBJECT, CHAPTER_OBJECT, 'this/is/path');

            var result = [];
            bsm.eachReference(function(obj) {
                result.push(obj[0].path);
            });

            expect(result.length).to.equal(2);
            expect(result).to.contain('this/is/path');
            expect(result).not.to.contain('bad');
        });
        it('objects have helper functions', function () {
            bsm.eachReference(function(obj) {
                expect(obj).property('eachChapter').to.be.a('function');
            });
        });
    });
});

describe('#makeBookStorageManager', function () {
    it('generates a BookStorageManager object', function () {
        makeBookStorageManager();
        expect(makeBookStorageManager()).to.be.a('Object'); // test more? how to test args?
    });
});