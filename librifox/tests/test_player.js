describe('Player()', function () {
    'use strict';
    
    var p, player_info, spy_pi_next;
    beforeEach(function () {
        p = new Player({
            createObjectURL: function (file) {return file.path},
            fileManager: { 
                getFileFromPath: function (path, success_func) {
                    success_func({type: 'File', path: path}); // not the actual file api
                }
            }
        });
        
        var chapter0 = {
                path: 'path0/to'
            },
            chapter1 = {
                path: 'path1/to'
            },
            book = {
                0: chapter0,
                1: chapter1
            }
        player_info = {
            book: book,
            chapter: chapter0,
            next: () => {}
        }
        spy_pi_next = sinon.spy(player_info, 'next');
    });
    
    afterEach(function () {
        spy_pi_next.reset();
    })
    
    // fire event on element
    function fireEvent(name, element) {
        var evObj = document.createEvent('Events');
        evObj.initEvent(name, true, false);
        element.dispatchEvent(evObj);
    }
    
    describe('#queueBook()', function () {
        it('sets audio element src to path of selected chapter', function () {
            p.queueBook(player_info);
            expect(p.getAudioElement().src).to.match(/path0\/to$/); // server adds localhost to url
        });
        it('calls PlayerInfo#next() when chapter completes', function () {
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
            p.queueBook(player_info);
            fireEvent('ended', p.getAudioElement());
            
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
            p.queueBook(player_info);
            p.next();
            expect(spy_pi_next).to.have.been.calledOnce;
        })
    })
    
    describe('#prettifyTime()', function () {
        it('generates a display string from a given number of seconds', function () {
            expect(p.prettifyTime(2.2)).to.equal('0:02');
            expect(p.prettifyTime(59.9)).to.equal('0:59');
            expect(p.prettifyTime(61)).to.equal('1:01');
            expect(p.prettifyTime(7261)).to.equal('2:01:01');
            expect(p.prettifyTime(363599)).to.equal('100:59:59');
        })
        it('allows a joiner string to be specified', function () {
            expect(p.prettifyTime(7261, 'aaa')).to.equal('2aaa01aaa01');
        })
    })
});