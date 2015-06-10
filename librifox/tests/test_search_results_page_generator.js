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

            books_response = [
                WEB_RESP.book_json,
                {
                    'id': 1234,
                    'title': 'placeholder book',
                    'description': 'this is a description'
                }
            ];

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
                'results_selector': bsrSelector
            });
        });

        afterEach(function () {
            $(bsrSelector).empty(); // I think Mocha / Karma might also clear #bSR, commenting this line has no effect on test outcomes
        });

        it('appends elements containing book results to selected parent element', function () {
            spg.displayResults('abc');
            expect($(bsrSelector).children().length).equal(2);
        });

        it('generates a LibriVox API url', function () {
            spg.displayResults('abcdefg');

            var url_passed_in = httpReqUrl;
            expect(url_passed_in).equal("https://librivox.org/api/feed/audiobooks/title/^abcdefg?&format=json");
        });

        it('populates elements with book titles and descriptions', function () {
            spg.displayResults('abc');

            var secondBookResult = $(bsrSelector).children()[1];
            var secondBookText = $(secondBookResult).text(); // these are implementation details, should the test just check whether the text exists?

            expect(secondBookText).match(/placeholder book/);
            expect(secondBookText).match(/this is a description/);
        });

        it('adds book-id attributes to each element in the selected parent', function () {
            spg.displayResults('abc');

            $('#bookSearchResults').children().each(function (i) {
                expect($(this).attr('book-id')).equal(books_response[i].id + ''); // no == #equals() in expect()?? Why?
            });
        });

        it('displays a message if no books are found', function () {
            spg.displayResults('NORESULT');

            expect($(bsrSelector).html()).match(/no books found/i);
        });

        it('clears results from a previous search before appending new elements', function () {
            spg.displayResults('abc');
            spg.displayResults('def');

            expect($(bsrSelector).children().length).to.equal(2);

            spg.displayResults('NORESULT');
            spg.displayResults('abc');

            expect($(bsrSelector).text()).not.match(/no books found/i);
        });
    });
    // TODO test #registerEvents?
});