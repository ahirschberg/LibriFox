describe('BookReferenceManager()', function () {
    "use strict";
    var store,
        ls_proto,
        brm;
    
    before(function () {
        ls_proto = {
            getItem: function (key) {
                return store[key] || null; // the store scope here is just icky
            },
            setItem: function (key, str) {
                store[key] = str;
            }
        };
    });
    beforeEach(function () {
        // regenerate store and storageMock for each test
        store = Object.create(ls_proto);
        brm = new BookReferenceManager({localStorage: store});

        store[brm.JSON_PREFIX + 9999] = JSON.stringify({
            0: {
                path: 'path1/to',
                name: 'Introduction'
            },
            title: BOOK_OBJECT.title
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
});