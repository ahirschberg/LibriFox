describe('BookFactory', function () {
    var bookFactory;
    beforeEach(function () {
        bookFactory = new BookFactory({
            deleteFile: () => {}
        })
    })
    describe('getBlankBook()', function () {
        it('returns an object with book functions in prototype', function () {
            var book = bookFactory.getBlankBook();
            console.log(book);
            expect(book.eachChapter).to.be.a('function');
            expect(book.deleteChapter).to.be.a('function');
        });
        describe('#eachChapter', function () {
            var book;
            before(function () {
                book = bookFactory.getBlankBook();
                book[2] = 'CHAPTER2'; // not the actual interface
                
                book.noindex = ['NI_CHAPTER'];
            })
            
            it('traverses all chapters', function () {
                var spy = sinon.spy();
                book.eachChapter(spy);
                
                expect(spy).to.have.been.calledTwice;
                expect(spy).to.have.been.calledWithExactly('CHAPTER2', 2, null);
                expect(spy).to.have.been.calledWithExactly('NI_CHAPTER', 0, book.noindex);
            })
        });
        describe('#deleteChapter', function () {
            function getFilledBook() {
                var book = bookFactory.getBlankBook();
                book[0] = {
                    name: 'A Chapter',
                    path: 'path/0.lfa'
                };
                book[1] = {
                    name: 'B Chapter',
                    path: 'path/1.lfa'
                };
                
                book.noindex = [{
                    name: 'C Chapter',
                    path: 'path/2.lfa'
                }]
                
                return book;
            }
            
            function getSingleChapterBook() {
                var book = bookFactory.getBlankBook();
                book[0] = {
                    name: 'A Chapter',
                    path: 'path/0.lfa'
                };
                return book;
            }
            
            it('deletes chapter path attribute matching obj.path or string', function () {
                var book = getFilledBook();
                
                book.deleteChapter({path: 'path/0.lfa'}); // obj with path property
                expect(book).not.to.have.property(0);
                expect(book).to.have.property(1);
                expect(book.noindex).to.have.property('length', 1);
                
                book.deleteChapter('path/2.lfa'); // path string
                expect(book.noindex).to.have.property('length', 0);
                expect(book).to.have.property(1);
            });
            it('sets hidden flag on book reference if no chapters are left', function () {
                var book = getSingleChapterBook();
                
                book.deleteChapter({path: 'path/0.lfa'});
                expect(book).to.have.property('hidden', true);
            })
        })
    });
});