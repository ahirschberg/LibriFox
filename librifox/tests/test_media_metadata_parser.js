// karma run -- --grep=MediaDB
describe('MediaDBMetadataParser', function () {
    var basic_blob = {
        name: 'path/to/file.abc'
    }
    function getID3Parser (stub) {
        var parse_promise = new Promise (function (resolve) {
            resolve(stub());
        });
        return {
            parse: () => parse_promise
        }
    }
    
    describe('#getParser', function () {
        it('returns a function', function () {
            expect(MediaDBMetadataParser.getParser()).to.be.a('function');
        })
        describe('returned function', function (done) {
            it('passes metadata to success callback if parse succeeds', function (done) {
                var parse_behavior = sinon.stub().returns({title: 'foo'}),
                    id3_parser = getID3Parser(parse_behavior),
                    parse_func = MediaDBMetadataParser.getParser(id3_parser),
                    spy_success = sinon.spy();
                
                parse_func(basic_blob, spy_success).then(() => {
                    expect(spy_success).to.have.been.calledOnce;
                    expect(spy_success).to.have.been.calledWith({title: 'foo'});
                    done();
                }).catch(PROMISE_CATCH);
            })
            it('calls success function with undefined if parse fails', function (done) {
                var parse_behavior = sinon.stub().throws(),
                    id3_parser = getID3Parser(parse_behavior),
                    parse_func = MediaDBMetadataParser.getParser(id3_parser),
                    spy_success = sinon.spy();
                
                parse_func(basic_blob, spy_success, undefined).then(() => {
                    expect(spy_success).to.have.been.calledOnce;
                    expect(spy_success.firstCall.args).to.eql([]);
                    done();
                }).catch(PROMISE_CATCH);
            })
        })
    })
})