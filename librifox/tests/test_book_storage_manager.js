describe('BookStorageManager()', function () {
    var bsm,
        storageDevice,
        storageMock;
        
    before(function () {
        storageDevice = { addNamed: function(blob, path) {} };
        
        bsm = new BookStorageManager({storageDevice: storageDevice});
    });
    
    beforeEach(function () {
        storageMock = sinon.mock(storageDevice);
    });
        
    describe('#writeChapter()', function () {
        it ('should generate chapter path via #getChapterFilePath and write to file system', function () {
            storageMock.expects('addNamed').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/0.mp3');
            bsm.writeChapter(WEB_RESP.audio_blob, 1234, 0);
            storageMock.verify();
        });
    });
    
    describe('#writeBook()', function () {
        it('should generate book path via #getBookFilePath and write to file system', function () {
            storageMock.expects('addNamed').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/full.zip');
            bsm.writeBook(WEB_RESP.audio_blob, 1234);
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
    describe('#getBookFilePath()', function () { // should be moved to new object
        it('should return the filepath of the book, based on id', function () {
            expect(bsm.getBookFilePath(BOOK_OBJECT.id)).equal('librifox/1234/full.zip');
        });
    });
    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            bsm.getChapterFilePath(BOOK_OBJECT);
        });
    });
});