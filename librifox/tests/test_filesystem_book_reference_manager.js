describe('FilesystemBookReferenceManager', function () {
    var fsbrm;
    before(function () {
        var
            mediadb_items = [
                {
                    name: 'librifox/app_dl/123/1.lfa'
            },
                {
                    name: 'other/abc.lfa',
                    metadata: {
                        album: 'Three Kewl Katz'
                    }
            },
                {
                    name: 'other/def.lfa',
                    metadata: {
                        album: 'Three Kewl Katz',
                        title: 'The Kewlest Kat of All',
                        tracknum: 1
                    }
            },
            null
        ],
            mediaManager = {
                db: {
                    state: 'enumerable'
                },
                enumerate: (func_each) => {
                    mediadb_items.forEach(func_each);
                },
                on: () => {},
                off: () => {}
            },
            bookReferenceManager = {
                loadBookReference: (id) => {
                    if (id === 123) {
                        return Promise.resolve({
                            1: {
                                name: 'Counting to One'
                            }
                        });
                    } else {
                        return Promise.resolve(undefined);
                    }
                }
            }

        fsbrm = new FilesystemBookReferenceManager({
            mediaManager: mediaManager,
            deviceStoragesManager: {
                getStorage: () => {}
            },
            bookReferenceManager: bookReferenceManager
        })
    })
    describe('dynamicLoadBooks', function () {

        function loadBooks(each_callback, then_callback, done) {
            if (!done) {
                console.warn('done() is undefined');
            }
            fsbrm.dynamicLoadBooks(each_callback).then(function () {
                then_callback.apply(this, arguments);
                done();
            }).catch(e => done(e));
        }

        it('returns an array of books', function (done) {
            var spy = sinon.spy();
            loadBooks(spy, function (books) {
                var books_store = books.store,
                    names = Object.keys(books_store).map(key => {
                        return books_store[key].title;
                    });

                expect(names).to.eql(['Book id: 123', 'Three Kewl Katz']);
            }, done);
        })
        it('calls each_book function for each new book', function (done) {
            var spy = sinon.spy();
            loadBooks(spy, function () {
                var book_ref_1 = spy.firstCall.args[0],
                    book_ref_2 = spy.secondCall.args[0];
                expect(spy).to.have.been.calledTwice;
                
                // could not get deep equals to work on full object.
                expect(book_ref_1).property(1).to.deep.equal({
                    name: 'Counting to One',
                    path: 'librifox/app_dl/123/1.lfa'
                });
                expect(book_ref_1).property('title').to.equal('Book id: 123');
                expect(book_ref_1).property('id').to.equal(123);
                
                // TODO add checks for book_ref_2
            }, done);
        })
    })
})