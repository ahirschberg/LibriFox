describe('PlayerInfo()', function () {
    describe('#next()', function () {
        it('goes to the next chapter in sequence', function () {
            var book = BookFactory.addFunctions({
                0: {
                    name: 'Chapter 01',
                    path: 'path0/to'
                },
                1: {
                    name: 'Chapter 02',
                    path: 'path1/to'
                },
                noindex: [{
                    name: 'Unindexed Chapter',
                    path: 'path2/to'
                }]
            });
            var pi = new PlayerInfo(book, book[0]);
            expect(pi.next()).to.eql(book[1]);
            expect(pi.next()).to.eql(book.noindex[0]);
        });
    });
    describe('#info_obj', function () {
        it('is an object with book and chapter properties', function () {
            var chapter0 = {
                    path: 'path0/to'
                },
                pi = new PlayerInfo({
                    id: 'A Book',
                    //0: chapter0
                }, chapter0);

            expect(pi.info_obj.book).property('id', 'A Book');
            
            expect(pi.info_obj).property('chapter', chapter0);
            expect(pi.info_obj).property('equals').to.be.a('function');
        })
        describe('#equals()', function () {
            it('returns true if book id and chapter path match, or false otherwise', function () {
                var chapter0 = {
                        path: 'path0/to'
                    },
                    pi = new PlayerInfo({
                        id: 'A Book',
                        0: chapter0
                    }, chapter0);

                expect(pi.info_obj.equals({
                    book: {
                        id: 'A Book'
                    },
                    chapter: {
                        path: 'path0/to'
                    }
                })).to.be.true;

                expect(pi.info_obj.equals({
                    book: {
                        id: 'B Book'
                    },
                    chapter: {
                        path: 'path0/to'
                    }
                })).to.be.false;
            })
        })
    })
})