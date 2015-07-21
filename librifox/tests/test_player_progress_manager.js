describe('PlayerProgressManager', function () {
    'use strict';
    var player,
        ppm,
        spy_updateUserData;
    
    function new_player () {
        var player_position = 0,
            event_manager = new EventManager();
        event_manager.registerEvents('timeupdate', 'pause', 'loadeddata', 'finishedqueue')
        return {
            position: function (p) {
                if (p) {
                    player_position = p;
                    event_manager.trigger('timeupdate');
                } else {
                    return player_position;
                }
            },
            pause: function () {
                event_manager.trigger('pause');
            },
            on: function (event_name, callback) {
                event_manager.on(event_name, callback);
            },
            getCurrentInfo: function () {
                return {
                    book: {id: 1337},
                    curr_index: 0
                }
            },
            _event_manager: event_manager
        };
    }
    
    beforeEach(function () {
        player = new_player();
        var referenceManager = {
            updateUserData: function () {}
        }
        spy_updateUserData = sinon.spy(referenceManager, 'updateUserData');
        
        ppm = new PlayerProgressManager({
            player: player,
            referenceManager: referenceManager
        });
    });
    
    describe('player events registered', function () {
        describe('timeupdate', function () {
            it('writes when time is >30 seconds off from last written time', function () {
                player.position(0);
                player.position(29.9);
                expect(spy_updateUserData).to.not.have.been.called;
                player.position(60);
                expect(spy_updateUserData).to.have.been.calledOnce;
                player.position(15);
                expect(spy_updateUserData).to.have.been.calledTwice;
            })
        })
        describe('pause', function () {
            it('writes when time is >1 second off from last written time', function () {
                var spy = spy_updateUserData.withArgs(1337, 0)
                player.position(0);
                player.pause();
                expect(spy).to.not.have.been.called;
                player.position(0.99);
                player.pause();
                expect(spy).to.not.have.been.called;
                player.position(2);
                player.pause();
                expect(spy).to.have.been.calledOnce;
                player.position(0.4);
                player.pause();
                expect(spy).to.have.been.calledTwice;
            })
        })
        describe('loadeddata', function () {
            it('writes each time', function () {
                player._event_manager.trigger('loadeddata');
                expect(spy_updateUserData).to.have.been.calledOnce;
            })
        })
        describe('finishedqueue', function () {
            it('writes each time with -1 as chapter index', function () {
                player._event_manager.trigger('finishedqueue', player.getCurrentInfo());
                expect(spy_updateUserData.withArgs(1337, -1)).to.have.been.calledOnce
            })
        })
    })
})