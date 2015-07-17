describe('Event()', function () {
    'use strict';
    describe('#registerCallback', function () {
        it('pushes callback to array', function () {
            var ev = new Event('myEvent'),
                callback = function () {}
            
            ev.registerCallback(callback);
            expect(ev.callbacks).to.contain(callback);
        })
    })
})

describe('EventManager()', function () {
    var event_manager;
    beforeEach(function () {
        event_manager = new EventManager();
    })
    describe('#registerEvent', function () {
        it('adds new event to events object', function () {
            event_manager.registerEvent('myFirstEvent');
            event_manager.registerEvent('mySecondEvent');
            
            expect(event_manager.events).to.have.property('myFirstEvent');
            expect(event_manager.events).to.have.property('mySecondEvent');
        })
    })
    describe('#on', function () {
        it('sets a callback for a given event', function () {
            event_manager.registerEvent('myEvent');
            var callback = function () {}
            event_manager.on('myEvent', callback);
            
            expect(event_manager.events['myEvent'].callbacks).contain(callback);
        })
    })
    describe('#trigger', function () {
        it('triggers a given event', function () {
            event_manager.registerEvent('myEvent');
            var spy1 = sinon.spy(),
                spy2 = sinon.spy();
            
            event_manager.on('myEvent', spy1);
            event_manager.on('myEvent', spy2);
            event_manager.trigger('myEvent', 'my_args');
            
            expect(spy1).to.have.been.calledWith('my_args');
            expect(spy2).to.have.been.calledWith('my_args');
        })
    })
})