describe('SettingsManager()', function () {
    'use strict' 
    
    var sm,
        async_storage;
    
    beforeEach(function () {
        async_storage = createFakeAsyncStorage();
        async_storage.setItem('lf_settings', {
            sample_key: 'foobar'
        });
        
        sm = new SettingsManager({
            asyncStorage: async_storage
        });
    });
    describe('#get()', function () {
        it('returns a promise ', function () {
            var promise = sm.get('lf_settings');
            expect(promise).to.be.a('promise');
        })
        it('loads settings object from asyncStorage when first called', function (done) {
            var spy = sinon.spy(async_storage, 'getItem');
            sm.get('lf_settings').then(() => {
                expect(spy).to.have.been.calledWith('lf_settings');
                done();
            }).catch(PROMISE_CATCH);
            
        });
        it('loads from settings object when called after first time', function () {
            sm.get('lf_settings').then(() => {
                var spy = sinon.spy(async_storage, 'getItem');
                sm.get('lf_settings').then(() => {
                    expect(spy).not.to.have.been.called;
                    done();
                });
            }).catch(PROMISE_CATCH);
            
        })
    })
    describe('#set()', function () {
        it('sets the value to the key', function () {
            sm.set('another_key', 'value').then( () => {
                sm.get('another_key').then(value => {
                    expect(value).to.equal('value')
                });
            })
        });
        it('writes settings object to storage', function () {
            async_storage.getItem('lf_settings', function (obj) {
                expect(obj).not.to.have.property('another_key');
            });
            sm.set('another_key', 'value');
            async_storage.getItem('lf_settings', function (obj) {
                expect(obj).property('another_key', 'value');
            });
        });
    });
});