describe('BookDownloadManager()', function () {
    var bdm, 
        storageMock,
        storageManager,
        testBlob,
        blobSpy;
    
    function newBDM(desired_args) {
        args = {
            'httpRequestHandler': httpRequestHandler,
            'storageManager': storageManager
        };
        
        // add or overwrite default properties with supplied args
        for (var attrname in desired_args) { args[attrname] = desired_args[attrname]; } 
        return new BookDownloadManager(args);
    }

    before(function () {


        function StubHttpRequestHandler() {
            this.getBlob = function (url, load_callback, other_args) {
                load_callback({response: testBlob});
            } // simulate LibriVox JSON title search response
            
            //this.test = testFunc; //temp
        }
        httpRequestHandler = new StubHttpRequestHandler();
        blobSpy = sinon.spy(httpRequestHandler, 'getBlob');

        storageManager = { test:         function (arg1) {}, // TODO remove this
                           writeBook:    function (blob, book_id) {},
                           writeChapter: function (blob, book_id, chapter_index) {} };
        storageMock = sinon.mock(storageManager);
        
        bdm = newBDM();
    });
    
    beforeEach(function () {
        blobSpy.reset();
    });

    describe('#downloadBook()', function () {
        it('should download the specified book', function () {
            storageMock.expects('writeBook').once().withExactArgs(testBlob, 1234);
            blobSpy.withArgs(BOOK_OBJECT.fullBookUrl); // same thing, different syntax. great.
            bdm.downloadBook(BOOK_OBJECT);
            expect(blobSpy.withArgs(BOOK_OBJECT.fullBookUrl).calledOnce).true
            storageMock.verify();
        });
    });
    describe('#downloadChapter()', function () {
        it('should download the specified chapter', function () {
            storageMock.expects('writeChapter').once().withExactArgs(testBlob, 1234, 0);
            bdm.downloadChapter(BOOK_OBJECT.id, CHAPTER_OBJECT);
            storageMock.verify();
        });
    });
    describe('progress_callback', function () {
        describe('progressBarSelector string supplied', function () {
            it('passes a progress callback to httpRequestHandler', function () {
                var tempBdm = newBDM({'progressSelector': '.progress'});
                tempBdm.downloadBook(BOOK_OBJECT);
                expect(blobSpy.getCall(0).args[2].progress_callback).a('function');
            });
            
            // should we check if the callback actually updates the progress bar?
        });
        describe('progressBarSelector string not supplied', function () {
            it('does not pass the callback function', function () {
                bdm.downloadBook(BOOK_OBJECT);
                expect(blobSpy.getCall(0).args[2].progress_callback).to.be.an('undefined');
            });
        });
    });
});