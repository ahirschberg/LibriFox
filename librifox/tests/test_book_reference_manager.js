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
        it('adds helper functions to object', function (done) {
            brm.loadBookReference(9999, function (book_ref) {
                expect(book_ref).property('eachChapter').to.be.a('function');
                done()
            });
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
    describe('#eachReference()', function () {
        it('takes a function and passes it each book key in async storage', function (done) {
            async_storage.setItem('abcdef', {
                0: {
                    path: 'bad'
                }
            });
            
            brm.storeChapterReference(BOOK_OBJECT, CHAPTER_OBJECT, 'this/is/path').then(() => {
                console.log('then called');
                var result = [];
                brm.eachReference(function (obj) {
                    console.log('pushing ', obj[0]);
                    result.push(obj[0].path);
                }, function () {
                    expect(result.length).to.equal(2);
                    expect(result).to.contain('this/is/path');
                    expect(result).not.to.contain('bad');
                    done();
                });
            }).catch(PROMISE_CATCH);
            async_storage.setItem('ghijk', {
                0: {
                    path: 'bad'
                }
            });
        });
        it('objects have helper functions', function (done) {
            brm.eachReference(function (obj) {
                expect(obj).property('eachChapter').to.be.a('function');
                done();
            });
        });
        it('calls done function when finished with last reference', function (done) {
            brm.storeChapterReference(
                {id: 9999},
                {
                    index: 0,
                    name: 'Chapter 00'
                },
                'path1/to'
            );
            brm.storeChapterReference(
                {id: 1234},
                {
                    index: 1,
                    name: 'Chapter 1'
                },
                'path2/to',
                {
                    reference_created: () => {
                        var count = 0;
                        brm.eachReference((ref) => {
                            console.log('Got ' + ref.id + ' adding to count.');
                            ++count;
                            console.log('count: ' + count);
                        }, () => {
                            console.log('done called ' + count);
                            console.log(count === 2);
                            expect(count).to.equal(2);
                            console.log('Count is now ' + count);
                            done();
                        });
                    }
                }
            ).catch(PROMISE_CATCH);
        })
    });
    describe('#everyChapter()', function () {
        it('iterates every chapter of every reference', function (done) {
            var book_obj_1 = {
                    id: 9999
                },
                book_obj_2 = {
                    id: 1234
                };
            brm.storeChapterReference(
                book_obj_1, {
                    index: 0,
                    name: 'Introduction'
                },
                'path2/to'
            );
            brm.storeChapterReference(
                book_obj_1, {
                    index: 1,
                    name: 'Chapter 1'
                },
                'path2/to'
            );
            brm.storeChapterReference(
                book_obj_2, {
                    index: 0,
                    name: 'Another Introduction'
                },
                'librifox/1234/0.mp3',
                {
                    reference_created: () => {
                        var every_chapter = [];
                        brm.everyChapter(function (chapter, book_ref, index) {
                            every_chapter.push({
                                ch_name: chapter.name,
                                ch_index: index,
                                book_id: book_ref.id
                            });
                        }, function () {
                            expect(every_chapter.length).to.equal(3);
                            expect(every_chapter).to.include({
                                ch_name: 'Introduction',
                                ch_index: 0,
                                book_id: 9999
                            });
                            expect(every_chapter).to.include({
                                ch_name: 'Chapter 1',
                                ch_index: 1,
                                book_id: 9999
                            });
                            expect(every_chapter).to.include({
                                ch_name: 'Another Introduction',
                                ch_index: 0,
                                book_id: 1234
                            });
                            done();
                        });
                    }
                }
            );
            
        });
    });
    describe('#updateUserData', function () {
       it('writes object to book_ref.user_progress', function (done) {
           brm.updateUserData(9999, 0, 10.1);
           brm.loadBookReference(9999, function (book_ref) {
               expect(book_ref.user_progress).to.eql({
                   current_chapter_index: 0,
                   position: 10.1
               });
               done() // just in case
           });
       });
    });
    describe('functions of returned book reference', function () {
        describe('#deleteChapter()', function () {
            it('deletes the chapter with the given index and writes to storage', function (done) {
                var mock_book = {
                    id: 9999
                };
                var mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }
                brm.storeChapterReference(mock_book, mock_chapter, 'path2/to');
                brm.loadBookReference(9999, function (book_ref) {
                    book_ref.deleteChapter(0).then(() => {
                        console.log('executing');
                        expect(book_ref).not.to.have.property(0);
                        expect(book_ref).property('1').to.be.an('object');

                        expect(spy_deleteFile).to.have.been.calledOnce;
                        async_storage.getItem('bookid_' + 9999, function (book_ref_copy) {
                            console.log(book_ref_copy);
                            expect(book_ref_copy).not.to.have.property(0);
                            expect(book_ref_copy).property('1').to.be.an('object');
                            done();
                        });
                    }).catch(PROMISE_CATCH);
                });
            });
            it('also deletes the book if it is the only chapter', function (done) {
                brm.loadBookReference(9999, function (book_ref) {
                    book_ref.deleteChapter(0).then(() => {
                        brm.loadBookReference(9999, function (book_ref_copy) {
                            expect(book_ref_copy).to.be.a('null');
                            done();
                        });
                    }).catch(PROMISE_CATCH);
                });
            });
        });
        describe('#deleteBook()', function () { // filesystem error case is untested
            it('deletes the book and writes to local_storage', function () {                
                var mock_book = {
                    id: 9999
                };
                var mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }
                brm.storeChapterReference(mock_book, mock_chapter, 'path2/to');

                var success_spy = sinon.spy();
                brm.loadBookReference(9999, function (book_ref) {
                    book_ref.deleteBook(success_spy);
                    brm.loadBookReference(9999, function (book_ref_copy) {
                        expect(book_ref_copy).to.be.a('null');
                    });
                    
                    expect(success_spy.callCount).to.equal(1);
                    expect(storageMgr_delete_spy.callCount).to.equal(2);
                });
            });
        });
    });
});