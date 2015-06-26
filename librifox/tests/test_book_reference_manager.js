describe('BookReferenceManager()', function () {
    "use strict";
    var store,
        ls_proto,
        brm,
        storageMgr_delete_spy;

    before(function () {
        ls_proto = {
            getItem: function (key) {
                return store[key] || null; // the store scope here is just icky
            },
            setItem: function (key, str) {
                store[key] = str;
            },
            removeItem: function (key) {
                delete store[key];
            }
        };
    });
    
    function clearStorage() {
        Object.keys(store).forEach(function (key) {
            delete store[key];
        });
    }
    beforeEach(function () {
        var mockStorageManager = {
            delete: function (path, success, fail) {
                success();
            }
        }
        storageMgr_delete_spy = sinon.spy(mockStorageManager, 'delete');

        // regenerate store and storageMock for each test
        store = Object.create(ls_proto);
        brm = new BookReferenceManager({
            localStorage: store,
            storageManager: mockStorageManager
        });

        store[brm.JSON_PREFIX + 9999] = JSON.stringify({
            0: {
                path: 'path1/to',
                name: 'Introduction'
            },
            title: BOOK_OBJECT.title,
            id: 9999
        });
    });

    describe('#loadJSONReference()', function () {
        it('loads book_reference from local_storage', function () {
            var book_ref = brm.loadJSONReference(9999);
            expect(book_ref).to.have.property(0);

            expect(book_ref).to.have.property('title', BOOK_OBJECT.title);
        });
        it('adds helper functions to object', function () {
            var book_ref = brm.loadJSONReference(9999);
            expect(book_ref).property('eachChapter').to.be.a('function');
        });
        it('adds reference to obj_storage', function () {
            var book_ref = brm.loadJSONReference(9999);
            expect(brm.obj_storage).to.have.property('bookid_9999');
        });
    });
    describe('#storeJSONReference', function () {
        it('writes to localstorage', function () {
            var fake_path = 'path/to/file',
                mock_book = {
                    id: 1111
                },
                mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }

            brm.storeJSONReference(mock_book, mock_chapter, fake_path);
            var ch1_ref = brm.loadJSONReference(1111)[1];
            expect(ch1_ref).to.have.property('path', fake_path);
            expect(ch1_ref).to.have.property('name', 'Chapter 1');
        });
        it('adds a title property if the entry doesn\'t already exist', function () {
            var fake_ch_index = 1,
                mock_book = {
                    id: 1111,
                    title: 'this is a title'
                };

            brm.storeJSONReference(mock_book, CHAPTER_OBJECT, 'path/to/file');
            expect(brm.loadJSONReference(1111)).to.have.property('title', mock_book.title);
        });
        it('appends new keys if object already exists', function () {
            var mock_book = {
                id: 9999
            };
            var mock_chapter = {
                index: 1,
                name: 'Chapter 1'
            }
            brm.storeJSONReference(mock_book, mock_chapter, 'path2/to');
            var stored = brm.loadJSONReference(9999);
            expect(stored[0]).to.be.a('object');
            expect(stored[1]).to.be.a('object');
        });
        it('stores indexed chapter references', function () {

            var book_ref = brm.loadJSONReference(9999),
                ch0_ref = book_ref[0];
            expect(ch0_ref).to.have.property('path', 'path1/to');
            expect(ch0_ref).to.have.property('name', 'Introduction');
        });
    });
    describe('#eachReference()', function () {
        it('takes a function and passes it each book key in local_storage', function () {
            store['abcdef'] = {
                0: {
                    path: 'bad'
                }
            };
            brm.storeJSONReference(BOOK_OBJECT, CHAPTER_OBJECT, 'this/is/path');

            var result = [];
            console.log(ls_proto.getItem('abcdef'));
            brm.eachReference(function (obj) {
                result.push(obj[0].path);
            });

            expect(result.length).to.equal(2);
            expect(result).to.contain('this/is/path');
            expect(result).not.to.contain('bad');
        });
        it('objects have helper functions', function () {
            brm.eachReference(function (obj) {
                expect(obj).property('eachChapter').to.be.a('function');
            });
        });
    });
    describe('#everyChapter()', function () {
        it('iterates every chapter of every reference', function () {
            clearStorage();
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
            it('deletes the chapter with the given index and writes to local_storage', function () {
                var mock_book = {
                    id: 9999
                };
                var mock_chapter = {
                    index: 1,
                    name: 'Chapter 1'
                }
                var success_spy = sinon.spy();
                brm.storeJSONReference(mock_book, mock_chapter, 'path2/to');
                var book_ref = brm.loadJSONReference(9999);
                book_ref.deleteChapter(0, success_spy);

                expect(book_ref).not.to.have.property(0);
                expect(book_ref).property('1').to.be.an('object');

                expect(success_spy.callCount).to.equal(1);
                expect(storageMgr_delete_spy.callCount).to.equal(1);

                expect(brm.loadJSONReference(9999)).not.to.have.property(0);
                expect(brm.loadJSONReference(9999)).property('1').to.be.an('object');
            });
            it('also deletes the book if it is the only chapter', function () {
                var book_ref = brm.loadJSONReference(9999);
                book_ref.deleteChapter(0);
                expect(brm.loadJSONReference(9999)).to.be.a('null');
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
                var book_ref = brm.loadJSONReference(9999);
                book_ref.deleteBook(success_spy);
                expect(success_spy.callCount).to.equal(1);
                expect(brm.loadJSONReference(9999)).to.be.a('null');
                expect(storageMgr_delete_spy.callCount).to.equal(2);
            });
        });
    });
});