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
            it('calls fail function if parse fails', function (done) {
                var parse_behavior = sinon.stub().throws(),
                    id3_parser = getID3Parser(parse_behavior),
                    parse_func = MediaDBMetadataParser.getParser(id3_parser),
                    spy_failure = sinon.spy();
                
                parse_func(basic_blob, undefined, spy_failure).then(() => {
                    expect(spy_failure).to.have.been.calledOnce;
                    done();
                }).catch(PROMISE_CATCH);
            })
            it('adds downloaded_in_app key to metadata if path matches regexp regardless of parser outcome', function (done) {
                var spy_success = sinon.spy(),
                    path_matcher_blob = {name: 'librifox/app_dl/01/02.lfa'},
                    good_parse_behavior = sinon.stub().returns({title: 'foo'}),
                    good_id3_parser = getID3Parser(good_parse_behavior),
                    good_parse_func = MediaDBMetadataParser.getParser(good_id3_parser);
                    
                
                good_parse_func(path_matcher_blob, spy_success).then(() => {
                    expect(spy_success).to.have.been.calledOnce;
                    console.log(spy_success.getCall(0).args)
                    expect(spy_success).to.have.been.calledWithExactly({
                        title: 'foo',
                        downloaded_in_app: true
                    });
                }).then(() => { // unfortunately, I have to chain tests one after another
                    spy_success.reset();
                    
                    var bad_parse_behavior = sinon.stub().throws(),
                        bad_id3_parser = getID3Parser(bad_parse_behavior),
                        bad_parse_func = MediaDBMetadataParser.getParser(bad_id3_parser);
                    
                    bad_parse_func(path_matcher_blob, spy_success).then(() => {
                        expect(spy_success).to.have.been.calledOnce;
                        console.log(spy_success.getCall(0).args)
                        expect(spy_success).to.have.been.calledWithExactly({
                            downloaded_in_app: true
                        });
                        
                        done();
                    }).catch(PROMISE_CATCH);
                })
            })
        })
    })
})