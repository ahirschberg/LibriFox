describe('BookDownloadManager()', function () {
    "use strict";
    var bdm, 
        writeChapterSpy,
        storageManager,
        testBlob,
        blobSpy;
    
    function newBDM(desired_args) {
        var args = {
            'httpRequestHandler': httpRequestHandler,
            'storageManager': storageManager,
            'fileManager': {
                tryWriteFile: function (path, callback) {
                    callback(true);
                }
            }
        };
        
        // add or overwrite default properties with supplied args
        for (var attrname in desired_args) {
            args[attrname] = desired_args[attrname];
        } 
        return new BookDownloadManager(args);
    }

    before(function () {
        testBlob = WEB_RESP.audio_blob;
        function StubHttpRequestHandler() {
            this.getBlob = function (url, load_callback, other_args) {
                load_callback({response: testBlob});
            } // simulate LibriVox JSON title search response
        }
        httpRequestHandler = new StubHttpRequestHandler();
        blobSpy = sinon.spy(httpRequestHandler, 'getBlob');

        storageManager = {
            writeChapter: function (blob, book_obj, chapter_obj) {},
            getChapterFilePath: function (id, index) {
                return 'foo/' + id + '/' + index + '.lfa'; 
            }
        };
        writeChapterSpy = sinon.spy(storageManager, 'writeChapter');
        
        bdm = newBDM();
    });
    
    beforeEach(function () {
        blobSpy.reset();
    });

    describe('#downloadChapter()', function () {
        it('should download the specified chapter', function () {
            bdm.downloadChapter(BOOK_OBJECT, CHAPTER_OBJECT);
            expect(writeChapterSpy.calledOnce).to.be.true;
            expect(writeChapterSpy.firstCall.calledWithExactly(
                    testBlob,
                    BOOK_OBJECT,
                    CHAPTER_OBJECT
                )).to.be.true;
        });
        describe('progressCallback', function () {
            describe('supplied', function () {
                it('passes a progress callback to httpRequestHandler', function () {
                    bdm.downloadChapter(BOOK_OBJECT, CHAPTER_OBJECT, function () {});
                    expect(blobSpy
                        .getCall(0)
                        .args[2]
                        .progress_callback
                    ).a('function'); // wow that message chain sure is ugly
                });
            });
            describe('not supplied', function () {
                it('does not pass the callback function', function () {
                    bdm.downloadChapter(BOOK_OBJECT, CHAPTER_OBJECT, undefined);
                    expect(blobSpy.getCall(0).args[2].progress_callback).to.be.an('undefined');
                });
            });
        });
    });
});