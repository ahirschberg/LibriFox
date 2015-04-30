describe('BookPlayerPageGenerator()', function () {
    var bppg, dlManager, dlManagerMock, chapterObjInstance, $test_div;

    before(function () {
        $test_div = $('<div></div>');
        $test_div.appendTo('body');

        dlManager = {
            downloadBook: function (book_id, chapter_obj) {},
            downloadChapter: function (book_obj) {}
        };
        dlManagerMock = sinon.mock(dlManager); // create wrapper object for dlManager

        bookPlayerArgs = {
            'bookDownloadManager': dlManager,
            'selectors': {
                'dlFullBook': '#downloadBook',
                'dlChapter': '#downloadChapter',
                'audioSource': '#audioSource',
            }
        };

        bppg = new BookPlayerPageGenerator(bookPlayerArgs);
    });

    beforeEach(function () {
        $test_div.empty();
        $('<audio id="audioSource"></audio>').appendTo($test_div);
        $('<button id="downloadChapter"></button>').appendTo($test_div);
        $('<button id="downloadBook"></button>').appendTo($test_div);
    });

    beforeEach(function () {
        chapterObjInstance = Object.create(CHAPTER_OBJECT); // prevents changes made to chapter obj from persisting between tests
    });

    describe('#generatePage()', function () {
        it('generates download book and download chapter buttons that send messages to downloadManager object on click', function () {
            bppg.generatePage({
                book: BOOK_OBJECT,
                chapter: chapterObjInstance
            });

            dlManagerMock.expects("downloadBook").once().withExactArgs(BOOK_OBJECT);
            $('#downloadBook').trigger('click'); // should call dlManager's #downloadBook method
            dlManagerMock.verify();

            dlManagerMock.expects("downloadChapter").once().withExactArgs(BOOK_OBJECT.id, chapterObjInstance);
            $('#downloadChapter').trigger('click');
            dlManagerMock.verify();
        });

        it('sets the audio element\'s src property to the chapter audio url', function () {
            bppg.generatePage({
                book: BOOK_OBJECT,
                chapter: chapterObjInstance
            });
            expect($('#audioSource').prop('src')).equal(chapterObjInstance.url);
        });

        /*it('updates chapter position property to match audio player position', function () {
          bppg.generatePage({book: BOOK_OBJECT, chapter: chapterObjInstance});
          $('#audioSource').currentTime = 10; // this doesn't work
          expect(chapterObjInstance.position).equal('10'); // TODO research how to set audio src position
        });*/
    });
});