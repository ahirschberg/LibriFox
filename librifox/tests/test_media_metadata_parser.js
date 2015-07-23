// karma run -- --grep=MediaDB
describe('MediaDBMetadataParser', function () {
    var blob = {
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
                
                parse_func(blob, spy_success).then(() => {
                    expect(spy_success).to.have.been.calledOnce;
                    expect(spy_success).to.have.been.calledWith({title: 'foo'});
                    done();
                }).catch(PROMISE_CATCH);
            })
            it('calls fail function if parse fails', function () {
                var parse_behavior = sinon.stub().throws(),
                    id3_parser = getID3Parser(parse_behavior),
                    parse_func = MediaDBMetadataParser.getParser(id3_parser),
                    spy_failure = sinon.spy();
                
                parse_func(blob, sinon.stub(), spy_failure).then(() => {
                    expect(spy_failure).to.have.been.calledOnce;
                    done();
                }).catch(PROMISE_CATCH);
            })
            it('adds downloaded_in_app key to metadata if path matches regexp', function () {
                
            })
        })
    })
})