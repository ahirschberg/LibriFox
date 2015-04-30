describe('#stripHTMLTags()', function () {
    it('removes all angle bracket pairs and enclosing strings', function () {
        expect(stripHTMLTags('<html>no<em> html</em><garbage\n-tag> tags.')).equal('no html tags.');
    });
    it('only removes text enclosed in brackets', function () {
        expect(stripHTMLTags('> Look, left and right angle brackets! <.')).equal('> Look, left and right angle brackets! <.');
    });
});