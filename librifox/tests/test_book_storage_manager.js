describe('BookStorageManager()', function () {
    var bsm,
        fileManager,
        storageMock,
        referenceMgrSpy,
        request;

    before(function () {
        fileManager = {
            addFile: function (blob, path) {
                return request;
            }
        };
        var deviceStoragesManager = {
            getDownloadsDevice: function () {
                return fileManager;
            }
        };
        var referenceMgrStub = {
            storeJSONReference: function (a, b, c, options) {
                options.reference_created();
            }
        };
        referenceMgrSpy = sinon.spy(referenceMgrStub, 'storeJSONReference');
        bsm = new BookStorageManager({
            deviceStoragesManager: deviceStoragesManager,
            referenceManager: referenceMgrStub
        });
    });

    beforeEach(function () {
        storageMock = sinon.mock(fileManager);
        request = {};
        referenceMgrSpy.reset();
    });

    describe('#writeChapter()', function () {
        it('should generate chapter path via #getChapterFilePath and write to file system', function () {
            storageMock.expects('addFile').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/0.lfa');
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, CHAPTER_OBJECT);
            storageMock.verify();
        });
        it('should call referenceManager#storeJSONReference with args', function (done) {
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, CHAPTER_OBJECT, done);
            request.onsuccess(); // simulate file write success
            
            expect(referenceMgrSpy.calledOnce).to.be.true;
            expect(referenceMgrSpy.firstCall.calledWith(
                BOOK_OBJECT,
                CHAPTER_OBJECT,
                'librifox/1234/0.lfa'
            )).to.be.true;
        });
    });
    describe('#write()', function () {
        it('should write the specified object to the filesystem', function () {
            storageMock.expects('addFile').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/01.lfa');
            bsm.write(WEB_RESP.audio_blob, 'librifox/1234/01.lfa');
            storageMock.verify();
        });
    });

    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            expect(bsm.getChapterFilePath(1234, 2)).to.equal('librifox/1234/2.lfa');
        });
    })
});