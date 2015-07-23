describe('BookDownloadManager()', function () {
    "use strict";
    var bdm, 
        writeChapterSpy,
        storageManager,
        testBlob,
        file_exists_bool,
        spy_httpreq_getBlob;

    before(function () {
        testBlob = WEB_RESP.audio_blob;
        function StubHttpRequestHandler() {
            this.getBlob = function (url, load_callback, other_args) {
                load_callback({response: testBlob});
            } // simulate LibriVox JSON title search response
        }
        var httpRequestHandler = new StubHttpRequestHandler();
        spy_httpreq_getBlob = sinon.spy(httpRequestHandler, 'getBlob');

        storageManager = {
            writeChapter: function (blob, book_obj, chapter_obj) {},
            getChapterFilePath: function (id, index) {
                return 'foo/' + id + '/' + index + '.lfa'; 
            }
        };
        writeChapterSpy = sinon.spy(storageManager, 'writeChapter');
        
        bdm = new BookDownloadManager({
            httpRequestHandler: httpRequestHandler,
            storageManager: storageManager,
            fileManager: {
                testForFile: function (path, callback) {
                    callback(file_exists_bool); // file does not exist
                }
            }
        });
    });
    
    beforeEach(function () {
        file_exists_bool = false;
        spy_httpreq_getBlob.reset();
    });

    describe('#downloadChapter()', function () {
        it('downloads the specified chapter', function () {
            bdm.downloadChapter({
                book: BOOK_OBJECT,
                chapter: CHAPTER_OBJECT
            });
            expect(writeChapterSpy.calledOnce).to.be.true;
            expect(writeChapterSpy.firstCall.calledWith(
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
                        spy_httpreq_getBlob.getCall(0).args[2].progress_callback
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
                        spy_httpreq_getBlob.getCall(0).args[2].progress_callback
                    ).to.be.an('undefined');
                });
            });
        });
    });
});