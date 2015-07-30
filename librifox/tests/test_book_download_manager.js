describe('BookDownloadManager()', function () {
    "use strict";
    var bdm, 
        writeChapterSpy,
        storageManager,
        testBlob,
        file_exists_bool,
        spies = {};

    before(function () {
        testBlob = WEB_RESP.audio_blob;
        function StubHttpRequestHandler() {
            this.getBlob = function (url, load_callback, other_args) {
                load_callback({response: testBlob});
            } // simulate LibriVox JSON title search response
        }
        var httpRequestHandler = new StubHttpRequestHandler();
        spies.hr_getBlob = sinon.spy(httpRequestHandler, 'getBlob');

        storageManager = {
            writeChapter: function (blob, book_obj, chapter_obj) {},
            getChapterFilePath: function (id, index) {
                return 'foo/' + id + '/' + index + '.lfa'; 
            }
        };
        spies.sm_writeChapter = sinon.spy(storageManager, 'writeChapter');
        
        var fileManager = {
            testForFile: function (path, callback) {
                callback(file_exists_bool); // file does not exist
            },
            deleteFile: () => Promise.resolve()
        };
        spies.fm_deleteFile = sinon.spy(fileManager, 'deleteFile');
        
        bdm = new BookDownloadManager({
            httpRequestHandler: httpRequestHandler,
            storageManager: storageManager,
            fileManager: fileManager
        });
        spies.bdm_downloadChapter = sinon.spy(bdm, 'downloadChapter');
    });
    
    beforeEach(function () {
        file_exists_bool = false;
        Object.keys(spies).forEach(key => {
            spies[key].reset();
        })
    });

    describe('#downloadChapter()', function () {
        it('downloads the specified chapter', function () {
            bdm.downloadChapter({
                book: BOOK_OBJECT,
                chapter: CHAPTER_OBJECT
            });
            expect(spies.sm_writeChapter.calledOnce).to.be.true;
            expect(spies.sm_writeChapter.firstCall.calledWith(
                    testBlob,
                    BOOK_OBJECT,
                    CHAPTER_OBJECT
                )).to.be.true;
        });
        it('calls error callback if file already exists', function () {
            var spy = sinon.spy();
            file_exists_bool = true;
            
            bdm.downloadChapter({
                book: BOOK_OBJECT,
                chapter: CHAPTER_OBJECT,
                callbacks: {
                    error: spy
                }
            });
            
            expect(spy).to.have.been.calledOnce;
        });
        describe('progressCallback', function () {
            describe('supplied', function () {
                it('passes a progress callback to httpRequestHandler', function () {
                    var progress_func = (() => {});
                    bdm.downloadChapter({
                        book: BOOK_OBJECT,
                        chapter: CHAPTER_OBJECT,
                        callbacks: {
                            progress: progress_func
                        }
                    });
                    // ugly way to get progress_callback
                    // forces our test to know getBlob interface :(
                    expect(
                        spies.hr_getBlob.getCall(0).args[2].progress_callback
                    ).to.be.a('function');
                });
            });
            describe('not supplied', function () {
                it('does not pass the callback function', function () {
                    bdm.downloadChapter({
                        book: BOOK_OBJECT,
                        chapter: CHAPTER_OBJECT
                    });
                    expect(
                        spies.hr_getBlob.getCall(0).args[2].progress_callback
                    ).to.be.an('undefined');
                });
            });
        });
    });
    describe('#forceDownloadChapter()', function () {
        it('deletes file at path, calls #downloadChapter() with arguments', function () {
            var args = {
                book: {id: 1337},
                chapter: {index: 0}
            };
            bdm.forceDownloadChapter(args).then(() => {
                expect(spies.fm_deleteFile).to.have.been.calledOnce;
                expect(spies.fm_deleteFile).to.have.been.calledWithExactly('foo/1337/0.lfa');
                
                expect(spies.bdm_downloadChapter).to.have.been.calledWithExactly(args);
            });
        })
    })
});