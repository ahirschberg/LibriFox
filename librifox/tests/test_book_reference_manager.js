describe('BookReferenceManager()', function () {
    "use strict";
    var async_storage,
        ls_proto,
        brm,
        storageMgr_delete_spy;
    
    before(function () {
        async_storage = createFakeAsyncStorage();
    });
    
    beforeEach(function () {
        async_storage._reset_store();
        var mockStorageManager = {
            delete: function (path, success, fail) {
                success();
            }
        }
        storageMgr_delete_spy = sinon.spy(mockStorageManager, 'delete');
        async_storage.setItem('bookid_9999', {
            0: {
                path: 'path1/to',
                name: 'Introduction'
            },
            title: BOOK_OBJECT.title,
            id: 9999
        });
        
        brm = new BookReferenceManager({
            asyncStorage: async_storage,
            storageManager: mockStorageManager
        });
    });

    describe('#loadJSONReference()', function () {
        it('loads book_reference from local_storage', function (done) {
            brm.loadJSONReference(9999, function (book_ref) {
                expect(book_ref).to.have.property(0);
                expect(book_ref).to.have.property('title', BOOK_OBJECT.title);
                done();
            });
            async_storage._call_pending_callbacks();
        });
        it('adds helper functions to object', function (done) {
            brm.loadJSONReference(9999, function (book_ref) {
                expect(book_ref).property('eachChapter').to.be.a('function');
                done();
            });
            async_storage._call_pending_callbacks();
        });
        it('adds reference to obj_storage', function (done) {
            brm.loadJSONReference(9999, function () {
                expect(brm.obj_storage).to.have.property('bookid_9999');
                done();
            });
            async_storage._call_pending_callbacks();

        });
    });
    describe('#storeJSONReference', function () {
        it('writes to async storage', function (done) {
            var fake_path = 'path/to/file',
                mock_book = {
                    id: 1111
                },
                mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }

            brm.storeJSONReference(mock_book, mock_chapter, fake_path);
            brm.loadJSONReference(1111, function (book_ref) {
                var ch1_ref = book_ref[1];
                expect(ch1_ref).to.have.property('path', fake_path);
                expect(ch1_ref).to.have.property('name', 'Chapter 1');
                done();
            });
            async_storage._call_pending_callbacks();
        });
        it('adds a title property if the entry doesn\'t already exist', function (done) {
            var fake_ch_index = 1,
                mock_book = {
                    id: 1111,
                    title: 'this is a title'
                };

            brm.storeJSONReference(mock_book, CHAPTER_OBJECT, 'path/to/file');
            brm.loadJSONReference(1111, function (book_ref) {
                expect(book_ref).to.have.property('title', mock_book.title);
                done();
            });
            async_storage._call_pending_callbacks();
        });
        it('appends new keys if object already exists', function (done) {
            var mock_book = {
                id: 9999
            };
            var mock_chapter = {
                index: 1,
                name: 'Chapter 1'
            }
            brm.storeJSONReference(mock_book, mock_chapter, 'path2/to');
            brm.loadJSONReference(9999, function (stored) {
                expect(stored[0]).to.be.a('object');
                expect(stored[1]).to.be.a('object');
                done();
            });
            async_storage._call_pending_callbacks();
        });
        it('stores indexed chapter references', function (done) {

            brm.loadJSONReference(9999, function (book_ref) {
                var ch0_ref = book_ref[0];
                expect(ch0_ref).to.have.property('path', 'path1/to');
                expect(ch0_ref).to.have.property('name', 'Introduction');
                done();
            });
            async_storage._call_pending_callbacks();
        });
    });
    describe('#eachReference()', function () {
        it('takes a function and passes it each book key in async storage', function () {
            async_storage._set_instant();
            async_storage.setItem('abcdef', {
                0: {
                    path: 'bad'
                }
            });
            brm.storeJSONReference(BOOK_OBJECT, CHAPTER_OBJECT, 'this/is/path');

            var result = [];
            brm.eachReference(function (obj) {
                result.push(obj[0].path);
            });

            expect(result.length).to.equal(2);
            expect(result).to.contain('this/is/path');
            expect(result).not.to.contain('bad');
        });
        it('objects have helper functions', function (done) {
            async_storage._set_instant();
            brm.eachReference(function (obj) {
                expect(obj).property('eachChapter').to.be.a('function');
                done();
            });
        });
    });
    describe('#everyChapter()', function () {
        it('iterates every chapter of every reference', function () {
            async_storage._set_instant();

            var book_obj_1 = {id: 9999},
                book_obj_2 = {id: 1234};
            brm.storeJSONReference(
                book_obj_1,
                {
                   index: 0,
                   name: 'Introduction'
                },
                'path2/to'
            );
            brm.storeJSONReference(
                book_obj_1,
                {
                   index: 1,
                   name: 'Chapter 1'
                },
                'path2/to'
            );
            brm.storeJSONReference(
                book_obj_2,
                {
                   index: 0,
                   name: 'Another Introduction'
                },
                'librifox/1234/0.mp3'
            );
            var every_chapter = [];
            brm.everyChapter(function (chapter, book_ref, index) {
                every_chapter.push({
                    ch_name: chapter.name,
                    ch_index: index,
                    book_id: book_ref.id
                });
            });
            
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
        });
    });
    describe('functions of returned book reference', function () {
        describe('#deleteChapter()', function () {
            it('deletes the chapter with the given index and writes to local_storage', function (done) {
                async_storage._set_instant();
                
                var mock_book = {
                    id: 9999
                };
                var mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }
                var success_spy = sinon.spy();
                brm.storeJSONReference(mock_book, mock_chapter, 'path2/to');
                brm.loadJSONReference(9999, function (book_ref) {
                    book_ref.deleteChapter(0, success_spy);

                    expect(book_ref).not.to.have.property(0);
                    expect(book_ref).property('1').to.be.an('object');

                    expect(success_spy.callCount).to.equal(1);
                    expect(storageMgr_delete_spy.callCount).to.equal(1);
                    brm.loadJSONReference(9999, function (book_ref_copy) {
                        expect(book_ref_copy).not.to.have.property(0);
                        expect(book_ref_copy).property('1').to.be.an('object');
                        done();
                    });
                });
            });
            it('also deletes the book if it is the only chapter', function (done) {
                async_storage._set_instant();
                brm.loadJSONReference(9999, function (book_ref) {
                    book_ref.deleteChapter(0);
                    brm.loadJSONReference(9999, function (book_ref_copy) {
                        expect(book_ref_copy).to.be.a('null');
                        done();
                    });
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
                brm.storeJSONReference(mock_book, mock_chapter, 'path2/to');

                var success_spy = sinon.spy();
                brm.loadJSONReference(9999, function (book_ref) {
                    async_storage._set_instant();
                    book_ref.deleteBook(success_spy);
                    brm.loadJSONReference(9999, function (book_ref_copy) {
                        expect(book_ref_copy).to.be.a('null');
                    });
                    
                    expect(success_spy.callCount).to.equal(1);
                    expect(storageMgr_delete_spy.callCount).to.equal(2);
                });
            });
        });
    });
});