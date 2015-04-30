describe('BookDownloadManager()', function () {
    var bdm, 
        storageMock,
        storageManager,
        testBlob;

    before(function () {
        function StubHttpRequestHandler() {
            this.getBlob = function (url, load_callback, other_args) {
                load_callback({response: testBlob});
            } // simulate LibriVox JSON title search response
        }

        storageManager = { test:         function (arg1) {}, // TODO remove this
                           writeBook:    function (blob, book_id) {},
                           writeChapter: function (blob, book_id, chapter_index) {} };
        storageMock = sinon.mock(storageManager);
        
        bdm = new BookDownloadManager({
            'httpRequestHandler': new StubHttpRequestHandler(),
            'storageManager': storageManager
        });
    });

    describe('#downloadBook()', function () {
        it('should download the specified book', function () {
          storageMock.expects('writeBook').once().withExactArgs(testBlob, 1234);
          bdm.downloadBook(BOOK_OBJECT);
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
});