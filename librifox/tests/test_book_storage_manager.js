describe('BookStorageManager()', function () {
    var bsm,
        fileManager,
        spy_rm_storeChapterReference,
        spy_fm_addFile,
        referenceMgrStub;
    
    before(function () {
        fileManager = {
            addFile: function (blob, path) {
                return Promise.resolve('path/to');
            }
        };
        spy_fm_addFile = sinon.spy(fileManager, 'addFile');
        
        var deviceStoragesManager = {
            getStorage: function () {
                return fileManager;
            },
            get downloadsStorageName() {return '/sdcard/'}
        };
        referenceMgrStub = {
            storeChapterReference: function (a, b, c, options) {
                options.reference_created();
            }
        };
        spy_rm_storeChapterReference = sinon.spy(referenceMgrStub, 'storeChapterReference');
        
        bsm = new BookStorageManager({
            deviceStoragesManager: deviceStoragesManager,
            referenceManager: referenceMgrStub
        });
    });

    beforeEach(function () {
        request = {};
        spy_rm_storeChapterReference.reset();
        spy_fm_addFile.reset();
    });

    describe('#writeChapter()', function () {
        it('should generate chapter path via #getChapterFilePath and write to file system', function (done) {
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, CHAPTER_OBJECT, () => {
                expect(spy_fm_addFile).to.have.been.calledWithExactly(WEB_RESP.audio_blob, '/sdcard/librifox/app_dl/1234/0.lfa');
                done();
            });
        });
        it('should call referenceManager#storeChapterReference with args', function (done) {
            bsm.writeChapter(WEB_RESP.audio_blob, BOOK_OBJECT, CHAPTER_OBJECT, () => {
                console.log(spy_rm_storeChapterReference.callCount);
                expect(spy_rm_storeChapterReference.calledOnce).to.be.true;
                expect(spy_rm_storeChapterReference).to.have.been.calledWith(
                    BOOK_OBJECT,
                    CHAPTER_OBJECT,
                    'path/to'
                );
                done();
            });
        });
    });
    describe('#write()', function () {
        it('should write the specified object to the filesystem', function () {
            bsm.write(WEB_RESP.audio_blob, '/sdcard/librifox/app_dl/1234/01.lfa');
            expect(spy_fm_addFile).to.have.been.calledWithExactly(WEB_RESP.audio_blob, '/sdcard/librifox/app_dl/1234/01.lfa')
        });
    });

    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            expect(bsm.getChapterFilePath(1234, 2)).to.equal('/sdcard/librifox/app_dl/1234/2.lfa');
        });
    })
});