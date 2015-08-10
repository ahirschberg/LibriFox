describe('FilesystemBookReferenceManager', function () {
    var fsbrm, mediaManager, mediadb_items;
    beforeEach(function () {
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
        ];
        
        var mm_event_manager = new EventManager();
        mm_event_manager.registerEvents('created', 'deleted')
        
        mediaManager = {
            db: {
                state: 'enumerable'
            },
            enumerate: (func_each) => {
                mediadb_items.forEach(func_each);
            },
            on: (name, cbk) => {
                mm_event_manager.on(name, cbk);
            },
            off: name => {
                mm_event_manager.off(name);
            },
            __trigger: (name, args) => {
                mm_event_manager.trigger(name, args);
            }
        };
        var bookReferenceManager = {
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
    
    function verifyBothBooks(book1, book2) {
        expect(book1).property('title').to.equal('Book id: 123');
        expect(book1).property('id').to.equal(123);
        expect(book1).property(1).to.deep.equal({
            name: 'Counting to One',
            path: 'librifox/app_dl/123/1.lfa'
        });
        expect(book1).not.to.have.property('noindex');

        expect(book2).property('title').to.equal('Three Kewl Katz');
        expect(book2).property('id').to.equal('Three Kewl Katz');
        expect(book2).property(1).to.deep.equal({
            name: 'The Kewlest Kat of All',
            path: 'other/def.lfa'
        });
        expect(book2).property('noindex').to.deep.equal([{
            name: 'other/abc.lfa',
            path: 'other/abc.lfa'
        }]);
    }
    
    function loadBooks(each_callback, then_callback, done) {
        if (!done) {
            console.warn('done() is undefined');
        }
        fsbrm.dynamicLoadBooks(each_callback).then(function () {
            then_callback.apply(this, arguments);
            done();
        }).catch(e => done(e));
    }
    
    describe('#dynamicLoadBooks()', function () {
        it('returns an array of books', function (done) {
            var spy = sinon.spy();
            loadBooks(spy, function (books) {
                var books_store = books.store,
                    book1 = books_store[123],
                    book2 = books_store['Three Kewl Katz'];
                verifyBothBooks(book1, book2);
            }, done);
        })
        it('calls each_book function for each new book', function (done) {
            var spy = sinon.spy();
            loadBooks(spy, function () {
                var book1 = spy.firstCall.args[0],
                    book2 = spy.secondCall.args[0];
                expect(spy).to.have.been.calledTwice;
                verifyBothBooks(book1, book2);
                
            }, done);
        })
    })
    describe('MediaDB file created event', function () {
        it('appends chapters to books in store from MediaDB event detail', function (done) {
            fsbrm.on('change', books => {
                var store = books.store,
                    book1 = store['123'],
                    book2 = store['Three Kewl Katz'];
                verifyBothBooks(book1, book2);
                done();
            });
            mediaManager.__trigger('created', {
                detail: mediadb_items.slice(0, -1) // remove null item from detail
            })
        })
    })
    describe('MediaDB file removed event', function () {
        it('removes chapters to books in store from MediaDB event detail', function (done) {
            // add books to store
            loadBooks(undefined, () => {
                fsbrm.on('change', books => {
                    var store = books.store,
                        book1 = store['123'],
                        book2 = store['Three Kewl Katz'];
                    console.log(store);
                    expect(book1).property('hidden').to.be.true;
                    expect(book2).property('title').to.equal('Three Kewl Katz');
                    expect(book2).property('id').to.equal('Three Kewl Katz');
                    expect(book2).property(1).to.deep.equal({
                        name: 'The Kewlest Kat of All',
                        path: 'other/def.lfa'
                    });
                    expect(book2).property('noindex').to.deep.equal([]);
                    done();
                });
                
                // remove null item and one TKK chapter from detail,
                // and only pass in direct paths
                var paths = mediadb_items.slice(0, 2).map(obj => {
                    return obj.name
                });
                mediaManager.__trigger('deleted', {
                    detail: paths 
                });
            }, e => {
                e && done(e);
            });
        })
    })
})