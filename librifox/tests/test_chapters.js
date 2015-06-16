describe('Chapter()', function () {
    'use strict';
    var generate_chapter = function () {
            return new Chapter({
                name: 'Chapter 01',
                index: 0,
                url: 'http://example.com/ch1.mp3',
            });
        };
    
    
    it('creates an object with name property', function () {
        expect(generate_chapter()).to.have.property('name', 'Chapter 01');
    });
    it('parses out CDATA sequence in name property if it exists', function () {
        var chapter = new Chapter({name: '<![CDATA[Chapter 02]]>'});
        expect(chapter).to.have.property('name', 'Chapter 02');
    });
    it('sets url and index attributes from args', function () {
        var chapter = generate_chapter();
        expect(chapter).to.have.property('index', 0);
        expect(chapter).to.have.property('url', 'http://example.com/ch1.mp3');
    });
    describe('#parseFromXML()', function () {
        it('takes an xml string and returns array of parsed chapter objects', function () {
            var chapters = Chapter.parseFromXML(WEB_RESP.book_xml);
            expect(chapters.length).to.equal(2);
            expect(chapters[0]).to.eql(generate_chapter()); // they coincidentally have the same values, could change later
        });
    });
});