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
        console.log(store, store.getItem);
        bsm = new BookStorageManager({
            storageDevice: storageDevice,
            localStorage: store
        });
        
        store[bsm.JSON_PREFIX + 9999] = JSON.stringify({
            0: 'path1/to',
            title: BOOK_OBJECT.title
        });
        storageMock = sinon.mock(storageDevice);
    });

    describe('#writeChapter()', function () {
        it('should generate chapter path via #getChapterFilePath and write to file system', function () {
            storageMock.expects('addNamed').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/0.mp3');
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, 0);
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
        it('loads object from local_storage', function () {
            expect(bsm.loadJSONReference(9999)).to.eql({
                0: 'path1/to',
                title: BOOK_OBJECT.title
            });
        });
    });
    describe('#storeJSONReference', function () {
        it('writes to localstorage', function () {
            var fake_path = 'path/to/file',
                fake_ch_index = 1,
                mock_book = {
                    id: 1111
                };

            bsm.storeJSONReference(mock_book, fake_ch_index, fake_path);
            expect(bsm.loadJSONReference(1111)).to.have.property(1, fake_path);
        });
        it('adds a title property if the entry doesn\'t already exist', function () {
            var fake_ch_index = 1,
                mock_book = {
                    id: 1111,
                    title: 'this is a title'
                };

            bsm.storeJSONReference(mock_book, 0, 'path/to/file');
            expect(bsm.loadJSONReference(1111)).to.have.property('title', mock_book.title);
        });
        it('appends new keys if object already exists', function () {
            var mock_book = {
                id: 9999
            };
            bsm.storeJSONReference(mock_book, 1, 'path2/to');
            var stored = bsm.loadJSONReference(9999);
            expect(stored).to.have.property(0, 'path1/to');
            expect(stored).to.have.property(1, 'path2/to');
        });
    });
    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            expect(bsm.getChapterFilePath(1234, 2)).to.equal('librifox/1234/2.mp3');
        });
    });
    describe('#eachReference()', function () {
        it('takes a function and passes it each book key in local_storage', function () {
            store['abcdef'] = {0: 'bad'};
            bsm.storeJSONReference(BOOK_OBJECT.id, 0, 'this/is/path');

            var result = [];
            bsm.eachReference(function(obj) {
                console.log(obj);
                result.push(obj[0]);
            });

            expect(result.length).to.equal(2);
            expect(result).to.contain('this/is/path');
            expect(result).not.to.contain('bad');
        });
    });
});

describe('#makeBookStorageManager', function () {
    it('generates a BookStorageManager object', function () {
        makeBookStorageManager();
        expect(makeBookStorageManager()).to.be.a('Object'); // test more? how to test args?
    });
});