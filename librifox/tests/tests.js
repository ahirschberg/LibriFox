// Mimic LibriVox JSON response
var BOOKS_JSON = {
    "books": [{
      "id": "59",
      "title": "Adventures of Huckleberry Finn",
      "description": "The Adventures of Huckleberry Finn is a novel by Mark Twain",
      "url-zip-file": "google.com/coolstuff.zip"
    }]
  };
var BOOKS_RSS =
    '<rss> <channel>' +
      '<item> <title><![CDATA[Chapter 01]]></title>' +
        '<enclosure url="http://example.com/ch1.mp3" length="4.2MB" type="audio/mpeg" />' +
      '</item>' +
      '<item> <title><![CDATA[Chapter 02]]></title>' +
        '<enclosure url="http://example.com/ch2.mp3" length="4.4MB" type="audio/mpeg" />' +
      '</item>' +
    '</channel> </rss>';

describe('#stripHTMLTags()', function () {
  it('removes all angle bracket pairs and enclosing strings', function () {
    assert.equal('no html tags.', stripHTMLTags('<html>no<em> html</em><garbage\n-tag> tags.'));
  })
  it('only removes text enclosed in brackets', function (){
    assert.equal('> Look, left and right angle brackets! <.', stripHTMLTags('> Look, left and right angle brackets! <.'));
  })
});

describe('Book()', function () {
  it('should create a new book with field info', function (){
    it('should create an instance of Book', function (){
      expect(new Book(BOOKS_JSON)).instanceOf(Book); // Is this test really necessary -- seems to be testing javascript base behavior and not our code itself
    })
    it('should create an id field for the book, if available', function(){
      assert.equal("59", new Book(BOOKS_JSON).id);
    })
    it('should create a title field for the book, if available, with stripped HTML tags', function(){
      assert.equal("Adventures of Huckleberry Finn", new Book(BOOKS_JSON).title);
    })
    it('should create a description field for the book, if available, with stripped HTML tags', function(){
      assert.equal("The Adventures of Huckleberry Finn is a novel by Mark Twain", Book(BOOKS_JSON).description);
    })
    it('should create an object for a total list of JSON for the book, if available', function(){
      assert.equal("test", new Book(BOOKS_JSON).json); // fix this line
    })
    it('should create an object for the zip file url for the book, if available', function(){
      assert.equal("google.com/coolstuff.zip", Book(BOOKS_JSON).fullBookURL);
    })
  })
})

describe('ChaptersListPageGenerator()', function() {
  describe('#generatePage()', function() {
    // TODO: figure out how to check html elements for test
  })
  // Should we test private methods?  I don't think it's necessary.
})