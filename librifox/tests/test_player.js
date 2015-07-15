describe('Player()', function () {
    describe('#queueBook()', function () {
        it('sets audio element src to given file', function () {
            var p = new Player({
                createObjectURL: function (file) {return 'blob:url'},
                fileManager: { 
                    getFileFromPath: function (path, success_func) {
                        success_func({type: 'File'});
                    }
                }
            });
            var book_ref = {
                0: {
                    path: 'path1/to',
                    name: 'Introduction'
                },
                title: 'FooBar',
                id: 9999
            }
            p.queueBook(book_ref, 0);
            expect(p.getAudioElement().src).to.match(/blob:url$/); // server adds localhost to url
        });
        it('queues the next chapter when the current one completes', function () {
            
        })
    });
});