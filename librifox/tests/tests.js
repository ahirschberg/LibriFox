// Begin testing
describe('#stripHTMLTags()', function () {
    it('removes all angle bracket pairs and enclosing strings', function () {
        expect(stripHTMLTags('<html>no<em> html</em><garbage\n-tag> tags.')).equal('no html tags.');
    });
    it('only removes text enclosed in brackets', function () {
        expect(stripHTMLTags('> Look, left and right angle brackets! <.')).equal('> Look, left and right angle brackets! <.');
    });
});

describe('Book()', function () {
    it('should create an instance of Book', function () {
        expect(new Book({
            'json': BOOK_JSON
        })).instanceOf(Book); // Is this test really necessary -- seems to be testing javascript base behavior and not our code itself
    });
    it('should create an id field for the book, if available', function () {
        expect(new Book({
            'json': BOOK_JSON
        }).id).equal('59');
    });
    it('should create a title field for the book, if available, with stripped HTML tags', function () {
        expect(new Book({
            'json': BOOK_JSON
        }).title).equal("Adventures of Huckleberry Finn");
    });
    it('should create a description field for the book, if available, with stripped HTML tags', function () {
        assert.equal("The Adventures of Huckleberry Finn is a novel by Mark Twain", new Book({
            'json': BOOK_JSON
        }).description);
    });
    it('should create an object for the zip file url for the book, if available', function () {
        expect(new Book({
            'json': BOOK_JSON
        }).fullBookURL).equal("google.com/coolstuff.zip");
    });
});

describe('ChaptersListPageGenerator()', function () {
    describe('#generatePage()', function () {
        before(function () {
            var ul = $('<ul data-role="listview" id="chapters-list"></ul>');
            ul.appendTo('body');
            ul.listview(); // initializes jQuery mobile listview - necessary for #listview('refresh') within #generatePage

            function StubHttpRequestHandler() {
                this.getXML = function (url, load_callback, other_args) {
                    load_callback({
                        'response': BOOK_XML
                    });
                }
            }

            var cpg = new ChaptersListPageGenerator({
                'httpRequestHandler': new StubHttpRequestHandler(),
                'selector': '#chapters-list'
            });
            cpg.generatePage(new Book({
                'json': BOOK_JSON
            }));
        });

        it('appends elements with chapter titles to selected parent element', function () {
            expect($('#chapters-list').children().length).equal(2);
            expect($('#chapters-list').children()[1].textContent).match(/^Chapter 02$/);
        });
        it('adds chapter-index attributes to each element in the selected parent', function () {
            $('#chapters-list').children().each(function (i) {
                expect($(this).attr('chapter-index')).equal(i + '');
            });
        });
    });
    // Should we test private methods?  I don't think it's necessary.
});

describe('SearchResltsPageGenerator()', function () {
    describe('#generatePage()', function () {
        var spg,
            bsrSelector,
            books_response;

        var httpReqUrl;


        before(function () {
            bsrSelector = '#bookSearchResults';

            var ul = $('<ul data-role="listview" id="bookSearchResults"></ul>');
            ul.appendTo('body');
            ul.listview();

            books_response = [BOOK_JSON, {
                'id': 1234,
                'title': 'placeholder book',
                'description': 'this is a description'
        }];

            function StubHttpRequestHandler() {
                this.getJSON = function (url, load_callback, other_args) {

                    httpReqUrl = url; // TODO: this is an ugly way to expose url argument

                    var response_arr = url.match(/\^NORESULT\?/) ? undefined : books_response;
                    load_callback({
                        'response': {
                            'books': response_arr
                        }
                    }); // simulate LibriVox JSON title search response
                }
            }

            spg = new SearchResltsPageGenerator({
                'httpRequestHandler': new StubHttpRequestHandler(),
                'selector': bsrSelector
            });
        });

        afterEach(function () {
            $(bsrSelector).empty(); // I think Mocha / Karma might also clear #bSR, commenting this line has no effect on test outcomes
        });

        it('appends elements containing book results to selected parent element', function () {
            spg.generatePage('abc');
            expect($(bsrSelector).children().length).equal(2);
        });

        it('generates a LibriVox API url', function () {
            spg.generatePage('abcdefg');

            var url_passed_in = httpReqUrl;
            expect(url_passed_in).equal("https://librivox.org/api/feed/audiobooks/title/^abcdefg?&format=json");
        });

        it('populates elements with book titles and descriptions', function () {
            spg.generatePage('abc');

            var secondBookResult = $(bsrSelector).children()[1];
            var secondBookText = $(secondBookResult).text(); // these are implementation details, should the test just check whether the text exists?

            expect(secondBookText).match(/placeholder book/);
            expect(secondBookText).match(/this is a description/);
        });

        it('adds book-id attributes to each element in the selected parent', function () {
            spg.generatePage('abc');

            $('#bookSearchResults').children().each(function (i) {
                expect($(this).attr('book-id')).equal(books_response[i].id + ''); // no == #equals() in expect()?? Why?
            });
        });

        it('displays a message if no books are found', function () {
            spg.generatePage('NORESULT');

            expect($(bsrSelector).html()).match(/no books found/i);
        });

        it('clears results from a previous search before appending new elements', function () {
            spg.generatePage('abc');
            spg.generatePage('def');

            expect($(bsrSelector).children().length).to.equal(2);

            spg.generatePage('NORESULT');
            spg.generatePage('abc');

            expect($(bsrSelector).text()).not.match(/no books found/i);
        });
    });
});

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

describe("BookDownloadManager()", function () {
    var bdm, 
        storageMock,
        storage,
        testBlob;

    before(function () {
        function StubHttpRequestHandler() {
            this.getBlob = function (url, load_callback, other_args) {
                load_callback({response: testBlob});
            } // simulate LibriVox JSON title search response
        }

        testBlob = {
            size: 4001234,
            type: "audio/mpeg"
        };

        storage = { addNamed: function (blob, path) {} };
        
        bdm = new BookDownloadManager({
            'httpRequestHandler': new StubHttpRequestHandler(),
            'storageDevice': storage
        });
    });

    beforeEach(function () {
        storageMock = sinon.mock(storage); // must re-mock for each test
    });

    describe('#downloadBook()', function () {
        it('should download the specified book', function () {
          storageMock.expects("addNamed").once().withExactArgs(testBlob, "librifox/1234/full.zip");
          bdm.downloadBook(BOOK_OBJECT);
          storageMock.verify();
        });
    });
    describe('#downloadChapter()', function () {
      it('should download the specified chapter', function () {
        storageMock.expects("addNamed").once().withExactArgs(testBlob, "librifox/1234/0.mp3");
        bdm.downloadChapter(BOOK_OBJECT.id, CHAPTER_OBJECT);
        storageMock.verify();
      });
    });
    // should be moved to new object
    /*describe('#write()', function () {
      it('should write the specified object to the filesystem', function () {
        storageMock.expects('addNamed').once().withExactArgs(testBlob, 'librifox/1234/01.mp3');
        bdm.write(testBlob, 'librifox/1234/01.mp3');
        storageMock.verify();
      });
    });*/
    describe('#getBookFilePath()', function () { // should be moved to new object
        it('should return the filepath of the book, based on id', function () {
            expect(bdm.getBookFilePath(BOOK_OBJECT.id)).equal('librifox/1234/full.zip');
        });
    });
    describe('#getChapterFilePath()', function () {
        it('should return the filepath of the chapter, based on id', function () {
            bdm.getChapterFilePath(BOOK_OBJECT);
        });
    });
});
