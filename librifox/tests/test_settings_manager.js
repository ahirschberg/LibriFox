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
    describe('async get behavior', function () {
        it('loads settings from async_storage once available', function () {
            
            var result = [];
            sm.getAsync('sample_key', function (val) {
                result.push('call 1');
            });
            sm.getAsync('sample_key', function (val) {
                result.push('call 2');
            });
            
            //expect(sm.get('sample_key')).to.be.an('error'); TODO look up how to check for error
            expect(result.length).to.equal(0);
            async_storage._call_pending_callbacks(); // simulates load of settings from storage
            expect(result.length).to.equal(2);
            expect(result).to.contain('call 1');
            expect(result).to.contain('call 2');
            expect(sm.get('sample_key')).to.equal('foobar');
        });
    });
    describe('#set()', function () {
        it('sets the value to the key', function () {
            async_storage._call_pending_callbacks(); // load settings object from async_storage
            sm.set('another_key', 'value');
            expect(sm.get('another_key')).to.equal('value');
        });
        it('writes settings object to storage', function () {
            async_storage._call_pending_callbacks();
            async_storage._set_instant();
            
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