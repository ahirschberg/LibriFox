describe('SearchResultsPageGenerator()', function () {
    'use strict';
    describe('#generatePage()', function () {
        var spg,
            books_response;

        var httpReqUrl;


        before(function () {
            var $el = $('<ul data-role="listview" id="results-listing"></ul><div class="no-results"/>');
            $el.appendTo('body');
            $('#results-listing').listview();

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

            spg = new SearchResultsPageGenerator({
                'httpRequestHandler': new StubHttpRequestHandler(),
            });
            spg.registerEvents({
                results_list: '#results-listing',
                no_results_msg: '.no-results'
            })
        });

        afterEach(function () {
            $('#results-listing').empty(); // I think Mocha / Karma might also clear #bSR, commenting this line has no effect on test outcomes
        });

        it('appends elements containing book results to selected parent element', function () {
            spg.displayResults('abc');
            expect($('#results-listing').children().length).equal(2);
        });

        it('generates a LibriVox API url', function () {
            spg.displayResults('abcdefg');

            var url_passed_in = httpReqUrl;
            expect(url_passed_in).equal("https://librivox.org/api/feed/audiobooks/title/^abcdefg?&format=json");
        });

        it('populates elements with book titles and descriptions', function () {
            spg.displayResults('abc');

            var secondBookResult = $('#results-listing').children()[1];
            var secondBookText = $(secondBookResult).text(); // these are implementation details, should the test just check whether the text exists?

            expect(secondBookText).match(/placeholder book/);
            expect(secondBookText).match(/this is a description/);
        });

        it('displays a message if no books are found', function () {
            expect($('.no-results').css('display')).to.equal('none');
            spg.displayResults('NORESULT');
            expect($('.no-results').css('display')).to.equal('block');
            spg.displayResults('valid search');
            expect($('.no-results').css('display')).to.equal('none');
        });

        it('clears results from a previous search before appending new elements', function () {
            spg.displayResults('abc');
            spg.displayResults('def');

            expect($('#results-listing').children().length).to.equal(2);

            spg.displayResults('NORESULT');
            spg.displayResults('abc');

            expect($('#results-listing').text()).not.match(/no books found/i);
        });
    });
    // TODO test #registerEvents?
});