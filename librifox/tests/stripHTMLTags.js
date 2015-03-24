var BOOKS_JSON =
{"books":[{
	"id":"59",
	"title":"Adventures of Huckleberry Finn",
	"description":"The Adventures of Huckleberry Finn is a novel by Mark Twain",
  "url-zip-file":"google.com/coolstuff.zip",
}]}
describe('#stripHTMLTags()', function() {
  it('removes all angle bracket pairs and enclosing strings', function() {
    assert.equal('no html tags.', stripHTMLTags('<html>no<em> html</em><garbage\n-tag> tags.'));
  })
  it('doesnt remove brackets if only one angle bracket is used', function(){
    assert.equal('Look, a left angle bracket! <.', stripHTMLTags('Look, a left angle bracket! <.'));
  })
  it('removes text if it is between a left and right angle bracket', function(){
    assert.equal('The following text is in angle brackets: ', stripHTMLTags('The following text is in angle brackets: <test>'))
  })
});

describe('Book()', function(){
  it('should create a new book with field info', function(){
    it('should create an instance of Book', function(){
      assert.equal(true, (Book(BOOKS_JSON) instanceof Book));
    })
    it('should create an id field for the book, if available', function(){
      
    })
    it('should create a title field for the book, if available, with stripped HTML tags', function(){
      
    })
    it('should create a description field for the book, if available, with stripped HTML tags', function(){
      
    })
    it('should create an object for a total list of JSON for the book, if available', function(){
      
    })
    it('should create an object for the zip file url for the book, if available', function(){
      
    })
  })
})
// Test JSON below
/*{"books":[{
	"id":"59",
	"title":"Adventures of Huckleberry Finn",
	"description":"The Adventures of Huckleberry Finn is a novel by Mark Twain",
  "url-zip-file":"google.com/coolstuff.zip",
  }]}*/
	