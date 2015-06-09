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

    describe('#downloadChapter()', function () {
        it('should download the specified chapter', function () {
            storageMock.expects('writeChapter').once().withExactArgs(testBlob, 1234, 0);
            bdm.downloadChapter(BOOK_OBJECT.id, CHAPTER_OBJECT);
            storageMock.verify();
        });
    });
    describe('progressCallback', function () {
        describe('supplied', function () {
            it('passes a progress callback to httpRequestHandler', function () {
                var tempBdm = newBDM({progress_callback: function () {}});
                tempBdm.downloadChapter(BOOK_OBJECT.id, CHAPTER_OBJECT);
                expect(blobSpy.getCall(0).args[2].progress_callback).a('function');
            });
        });
        describe('not supplied', function () {
            it('does not pass the callback function', function () {
                bdm.downloadChapter(BOOK_OBJECT.id, CHAPTER_OBJECT);
                expect(blobSpy.getCall(0).args[2].progress_callback).to.be.an('undefined');
            });
        });
    });
});