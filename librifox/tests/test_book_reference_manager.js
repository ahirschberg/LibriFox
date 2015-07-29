describe('BookReferenceManager()', function () {
    "use strict";
    var async_storage,
        ls_proto,
        spy_deleteFile,
        brm;
    
    before(function () {
        async_storage = createFakeAsyncStorage();
    });
    
    beforeEach(function () {
        async_storage._reset_store();
        async_storage.setItem('bookid_9999', {
            0: {
                path: 'path1/to',
                name: 'Introduction'
            },
            title: BOOK_OBJECT.title,
            id: 9999
        });
        
        var fileManager = {
            deleteFile: function () {
                return Promise.resolve();
            }
        }
        spy_deleteFile = sinon.spy(fileManager, 'deleteFile');
        
        brm = new BookReferenceManager({
            asyncStorage: async_storage,
            fileManager: fileManager
        });
    });

    describe('#loadBookReference()', function () {
        it('loads book_reference from local_storage', function (done) {
            brm.loadBookReference(9999, function (book_ref) {
                expect(book_ref).to.have.property(0);
                expect(book_ref).to.have.property('title', BOOK_OBJECT.title);
                done();
            }).catch(PROMISE_CATCH);
        });
        it('adds reference to obj_storage', function (done) {
            brm.loadBookReference(9999, function () {
                expect(brm.obj_storage).to.have.property('bookid_9999');
                done();
            });
        });
        it('returns a promise that can be used in place of a callback', function (done) {
            var p = brm.loadBookReference(9999);
            expect(p).property('then').to.be.a('function');
            
            p.then(book_ref => {
                expect(book_ref).property(0).to.be.an('object');
                done();
            });
        })
    });
    describe('#storeChapterReference', function () {
        it('writes to async storage', function (done) {
            var fake_path = 'path/to/file',
                mock_book = {
                    id: 1111
                },
                mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }

            brm.storeChapterReference(mock_book, mock_chapter, fake_path).then( () => {
                brm.loadBookReference(1111, function (book_ref) {
                    var ch1_ref = book_ref[1];
                    expect(ch1_ref).to.have.property('path', fake_path);
                    expect(ch1_ref).to.have.property('name', 'Chapter 1');
                    done();
                });
            });
        });
        it('adds a title property if the entry doesn\'t already exist', function (done) {
            var fake_ch_index = 1,
                mock_book = {
                    id: 1111,
                    title: 'this is a title'
                };

            brm.storeChapterReference(mock_book, CHAPTER_OBJECT, 'path/to/file').then( () => {
                brm.loadBookReference(1111, function (book_ref) {
                    expect(book_ref).to.have.property('title', mock_book.title);
                    done();
                });
            });
        });
        it('appends new keys if object already exists', function (done) {
            var mock_book = {
                id: 9999
            };
            var mock_chapter = {
                index: 1,
                name: 'Chapter 1'
            }
            brm.storeChapterReference(mock_book, mock_chapter, 'path2/to').then( () => {
                brm.loadBookReference(9999, function (stored) {
                    expect(stored[0]).to.be.a('object');
                    expect(stored[1]).to.be.a('object');
                    done();
                });
            })
        });
        it('stores indexed chapter references', function (done) {
            brm.loadBookReference(9999, function (book_ref) {
                var ch0_ref = book_ref[0];
                expect(ch0_ref).to.have.property('path', 'path1/to');
                expect(ch0_ref).to.have.property('name', 'Introduction');
                done();
            });
        });
    });
    describe('#updateUserData', function () {
       it('writes object to book_ref.user_progress', function (done) {
           var user_progress = {
               path: 'path0/to',
               position: 12.345
           };
           brm.updateUserData(9999, user_progress).then(() => {
               brm.loadBookReference(9999).then(book_ref => {
                   expect(book_ref.user_progress).to.eql(user_progress);
                   done()
               });
           }).catch(PROMISE_CATCH);
       });
    });
});