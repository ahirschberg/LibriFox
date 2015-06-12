describe('ChaptersListPageGenerator()', function () { // TODO test downloading
    describe('#generatePage()', function () {
        before(function () {
            var ul = $('<ul data-role="listview" id="chapters-list"></ul>');
            ul.appendTo('body');
            ul.listview(); // initializes jQuery mobile listview - necessary for #listview('refresh') within #generatePage

            function StubHttpRequestHandler() {
                this.getXML = function (url, load_callback, other_args) {
                    load_callback({
                        'response': WEB_RESP.book_xml
                    });
                }
            }

            var cpg = new ChaptersListPageGenerator({
                'httpRequestHandler': new StubHttpRequestHandler(),
                'list_selector': '#chapters-list' // todo test book name in header
            });
            cpg.generatePage(new Book({
                'json': WEB_RESP.book_json
            }));
        });

        it('appends elements with chapter titles to selected parent element', function () { // these tests now ignore the download all button, which is untested :P
            expect($('#chapters-list').children('.chapter-listing').length).equal(2);
            expect($('#chapters-list').children('.chapter-listing')[1].textContent).match(/^Chapter 02$/);
        });
        it('adds chapter-index attributes to each element in the selected parent', function () {
            $('#chapters-list').children('.chapter-listing').each(function (i) {
                expect($(this).attr('chapter-index')).equal(i + '');
            });
        });
    });
});