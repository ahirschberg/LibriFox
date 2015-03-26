// Mimic LibriVox JSON response
var BOOKS_JSON = {
    "books":[{
       "id":"59", 
       "title":"Adventures of Huckleberry Finn", 
       "description": "The Adventures of Huckleberry Finn is a novel by Mark Twain",
       "url-zip-file":"google.com/coolstuff.zip"
   }]
}

describe('#stripHTMLTags()', function() {
  it('removes all angle bracket pairs and enclosing strings', function() {
    assert.equal('no html tags.', stripHTMLTags('<html>no<em> html</em><garbage\n-tag> tags.'));
  })
  it('only removes text enclosed in brackets', function(){
    assert.equal('> Look, left and right angle brackets! <.', stripHTMLTags('> Look, left and right angle brackets! <.'));
  })
});

describe('Book()', function(){
  it('should create a new book with field info', function(){
    it('should create an instance of Book', function(){
      assert.equal(true, (Book(BOOKS_JSON) instanceof Book)); // There must a cleaner way to do this but I don't know what it is :(
    })
    it('should create an id field for the book, if available', function(){
      assert.equal("59", (Book(BOOKS_JSON).id);
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