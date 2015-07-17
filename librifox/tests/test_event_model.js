describe('EventManager()', function () {
    var event_manager;
    beforeEach(function () {
        event_manager = new EventManager();
    })
    describe('#registerEvent()', function () {
        it('adds new event to events object', function () {
            event_manager.registerEvent('myFirstEvent');
            event_manager.registerEvent('mySecondEvent');
            
            expect(event_manager.events).to.have.property('myFirstEvent');
            expect(event_manager.events).to.have.property('mySecondEvent');
        })
    })
    describe('#on()', function () {
        it('sets a callback for a given event', function () {
            event_manager.registerEvent('myEvent');
            var callback = function () {}
            event_manager.on('myEvent', callback);
            
            var callback_obj = event_manager.events['myEvent'].callbacks[0];
            expect(callback_obj).to.have.property('callback', callback);
        })
        it('allows for a namespace to be set by suffixing event name', function () {
            event_manager.registerEvent('myEvent');
            var callback = function () {}
            event_manager.on('myEvent.myNamespace', callback);
            
            var callback_obj = event_manager.events['myEvent'].callbacks[0];
            expect(callback_obj).to.have.property('callback', callback);
            expect(callback_obj).to.have.property('namespace', 'myNamespace');
        })
    })
    describe('#trigger()', function () {
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
        it('triggers namespaced events', function () {
            event_manager.registerEvent('myEvent');
            var spy1 = sinon.spy(),
                spy2 = sinon.spy();
            
            event_manager.on('myEvent', spy1);
            event_manager.on('myEvent.namespace', spy2);
            event_manager.trigger('myEvent', 'my_args');
            
            expect(spy1).to.have.been.calledWith('my_args');
            expect(spy2).to.have.been.calledWith('my_args');
        })
    })
    describe('#off()', function () {
        it('removes all events of a given type if no namespace given', function () {
            event_manager.registerEvent('myEvent');
            var spy1 = sinon.spy(),
                spy2 = sinon.spy();
            
            event_manager.on('myEvent', spy1);
            event_manager.on('myEvent.namespace', spy2);
            
            event_manager.off('myEvent');
            event_manager.trigger('myEvent', 'my_args');
            
            expect(spy1).to.not.have.been.called;
            expect(spy2).to.not.have.been.called;
        })
        it('only targets callbacks with matching namespace if one is provided', function () {
            event_manager.registerEvent('myEvent');
            var spy1 = sinon.spy(),
                spy2 = sinon.spy();
            
            event_manager.on('myEvent', spy1);
            event_manager.on('myEvent.namespace', spy2);
            
            event_manager.off('myEvent.namespace');
            event_manager.trigger('myEvent', 'my_args');
            
            expect(spy1).to.have.been.calledOnce;
            expect(spy2).to.not.have.been.called;
        })
    })
})