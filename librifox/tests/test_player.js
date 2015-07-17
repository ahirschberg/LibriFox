describe('Player()', function () {
    var p;
    beforeEach(function () {
        p = new Player({
            createObjectURL: function (file) {return file.path},
            fileManager: { 
                getFileFromPath: function (path, success_func) {
                    success_func({type: 'File', path: path}); // not the actual file api
                }
            }
        });
    });
    
    // fire event on element
    function fireEvent(name, element) {
        var evObj = document.createEvent('Events');
        evObj.initEvent(name, true, false);
        element.dispatchEvent(evObj);
    }
    
    describe('#queueBook()', function () {
        it('sets audio element src to given file', function () {
            var book_ref = {
                0: {
                    path: 'path1/to',
                    name: 'Introduction'
                },
                title: 'FooBar',
                id: 9999
            }
            p.queueBook(book_ref, 0);
            expect(p.getAudioElement().src).to.match(/path1\/to$/); // server adds localhost to url
        });
        it('plays the next chapter when the current one completes', function () {
            var book_ref = {
                0: {
                    path: 'path1/to',
                    name: 'Introduction'
                },
                1: {
                    path: 'path2/to',
                    name: 'Chapter One'
                },
                title: 'FooBar',
                id: 9999
            }
            p.queueBook(book_ref, 0);
            fireEvent('ended', p.getAudioElement());
            expect(p.getAudioElement().src).to.match(/path2\/to$/);
        })
    });
    
    describe('#playFromPath()', function () {
        it('sets the audio src to the given path', function () {
            p.playFromPath('path1/to')
            expect(p.getAudioElement().src).to.match(/path1\/to$/);
        });
    });
    
    describe('#next()', function () {
        it('skips to the next chapter', function () {
            var book_ref = {
                0: {
                    path: 'path1/to',
                    name: 'Introduction'
                },
                1: {
                    path: 'path2/to',
                    name: 'Chapter One'
                },
                title: 'FooBar',
                id: 9999
            }
            p.queueBook(book_ref, 0);
            p.next();
            expect(p.getAudioElement().src).to.match(/path2\/to$/);
        })
    })
});