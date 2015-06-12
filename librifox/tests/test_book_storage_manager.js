describe('BookStorageManager()', function () {
    var bsm,
        storageDevice,
        storageMock,
        referenceMgrSpy;

    before(function () {
        storageDevice = {
            addNamed: function (blob, path) {}
        };
        var referenceMgrStub = {
            storeJSONReference: function () {}
        };
        referenceMgrSpy = sinon.spy(referenceMgrStub, 'storeJSONReference');
        bsm = new BookStorageManager({
            storageDevice: storageDevice,
            referenceManager: referenceMgrStub
        });
    });

    beforeEach(function () {
        storageMock = sinon.mock(storageDevice);
        referenceMgrSpy.reset();
    });

    describe('#writeChapter()', function () {
        it('should generate chapter path via #getChapterFilePath and write to file system', function () {
            storageMock.expects('addNamed').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/0.mp3');
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, CHAPTER_OBJECT);
            storageMock.verify();
        });
        it('should call referenceManager#storeJSONReference with args', function () {
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, CHAPTER_OBJECT);
                        console.log(referenceMgrSpy.callCount);

            expect(referenceMgrSpy.calledOnce).to.be.true;
            expect(referenceMgrSpy.firstCall.calledWithExactly(
                BOOK_OBJECT,
                CHAPTER_OBJECT,
                'librifox/1234/0.mp3'
            )).to.be.true;

        });
    });
    describe('#write()', function () {
        it('should write the specified object to the filesystem', function () {
            storageMock.expects('addNamed').once().withExactArgs(WEB_RESP.audio_blob, 'librifox/1234/01.mp3');
            bsm.write(WEB_RESP.audio_blob, 'librifox/1234/01.mp3');
            storageMock.verify();
        });
    });

    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            expect(bsm.getChapterFilePath(1234, 2)).to.equal('librifox/1234/2.mp3');
        });
    })
});