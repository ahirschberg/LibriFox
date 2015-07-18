describe('SearchedBookChaptersPageGenerator()', function () {
    "use strict";
    describe('#generatePage()', function () {
        var dlSpy, book_obj, cpg;

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

            var dlManager = {
                downloadChapter: function () {}
            };
            dlSpy = sinon.spy(dlManager, 'downloadChapter');

            cpg = new SearchedBookChaptersPageGenerator({
                httpRequestHandler: new StubHttpRequestHandler(),
                selectors: {
                    list: '#chapters-list'
                },
                bookDownloadManager: dlManager
            });
        });

        beforeEach(function () {
            dlSpy.reset();
            book_obj = Object.create(BOOK_OBJECT); // because chapters are added, don't use global
            $('#chapters-list').empty();
        });

        describe('download all button', function () {
            it('appends download all button as first child element', function () {
                cpg.generatePage(book_obj);
                expect($('#chapters-list').children()[0].textContent).match(/download all chapters/i);
            });
            it('downloads all chapters when clicked', function () {
                cpg.generatePage(book_obj);
                var chapters_list_children = $('#chapters-list').children(),
                    $download_all_btn = $(chapters_list_children[0]);

                $download_all_btn.trigger('click');
                var first_call = {
                        book_object: dlSpy.firstCall.args[0],
                        chapter_object: dlSpy.firstCall.args[1],
                        callback: dlSpy.firstCall.args[2]
                    },
                    chapter_1_obj = Chapter.parseFromXML(WEB_RESP.book_xml)[0];
                
                // wish there was a better way to flexibly check args
                expect(dlSpy.callCount).to.equal(2);
                expect(book_obj).eql(first_call.book_object);
                expect(chapter_1_obj).eql(first_call.chapter_object);
                expect(first_call.callback).to.be.a('function');
            });
            it('adds chapters array to book object', function () {
                console.log(book_obj.chapters);
                expect(book_obj.chapters).to.be.an('undefined');
                
                cpg.generatePage(book_obj);
                
                expect(book_obj.chapters).to.be.an('array');
                expect(book_obj.chapters.length).to.equal(2);
                expect(book_obj.chapters[1]).to.eql(Chapter.parseFromXML(WEB_RESP.book_xml)[1]);
            });
        });

        describe('download chapter buttons', function () {
            it('appends elements with chapter titles to selected parent element', function () { // these tests now ignore the download all button, which is untested :P
                cpg.generatePage(book_obj);
                expect($('#chapters-list').children('.chapter-listing').length).equal(2);
                expect($('#chapters-list').children('.chapter-listing')[1].textContent).match(/^Chapter 02$/);
            });
            it('adds chapter-index attributes to each element in the selected parent', function () {
                cpg.generatePage(book_obj);
                $('#chapters-list').children('.chapter-listing').each(function (i) {
                    expect($(this).attr('chapter-index')).equal(i + '');
                });
            });
        });
    });
});