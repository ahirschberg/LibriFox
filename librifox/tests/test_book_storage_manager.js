describe('BookStorageManager()', function () {
    var bsm,
        storageDevice,
        storageMock,
        store;

    before(function () {
        storageDevice = {
            addNamed: function (blob, path) { }
        };
        
        var ls = {
            getItem: function (key) {
                return store[key] || null;
            },
            setItem: function (key, str) {
                store[key] = str;
            }
        };

        bsm = new BookStorageManager({
            storageDevice: storageDevice,
            localStorage: ls
        });
    });

    beforeEach(function () {
        // regeneratre store and storageMock for each test
        store = {9999: JSON.stringify({0: 'path1/to', title: BOOK_OBJECT.title}) };
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
    describe('#storeJSONReference', function () {
        it('writes to localstorage', function () {
            var fake_path = 'path/to/file',
                fake_ch_index = 1,
                mock_book = {id: 1111};

            bsm.storeJSONReference(mock_book, fake_ch_index, fake_path);
            expect(JSON.parse(store[mock_book.id])).to.have.property(1, fake_path);
        });
        it('adds a title property if the entry doesn\'t already exist', function () {
            var fake_ch_index = 1,
                mock_book = {id: 1111,
                             title: 'this is a title'};
            
            bsm.storeJSONReference(mock_book, 0, 'path/to/file');
            expect(JSON.parse(store[mock_book.id])).to.have.property('title', mock_book.title);
        });
        it('appends new keys if object already exists', function () {
            var mock_book = {id: 9999};
            bsm.storeJSONReference(mock_book, 1, 'path2/to');
            var stored = JSON.parse(store[9999]);
            expect(stored).to.have.property(0, 'path1/to');
            expect(stored).to.have.property(1, 'path2/to');
        });

                it('adds a title property if the entry doesn\'t already exist', function () {
            var fake_path = 'path/to/file',
                fake_ch_index = 1,
                mock_book = {id: 1111};
            
            bsm.storeJSONReference(mock_book, fake_ch_index, fake_path);
        });
    });
    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            expect(bsm.getChapterFilePath(1234, 2)).to.equal('librifox/1234/2.mp3');
        });
    });
});

describe('#makeBookStorageManager', function () {
    it('generates a BookStorageManager object', function () {
        makeBookStorageManager();
        expect(makeBookStorageManager()).to.be.a('Object'); // test more? how to test args?
    });
});