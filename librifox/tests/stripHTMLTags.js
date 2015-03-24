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
      assert.equal(true, (Book() instanceof Book));
    })
    it('should create an id field for the book, if available', function(){
      
    })
    it('should create a title field for the book, if available, with stripped HTML tags', function(){
      
    })
    it('should create a description field for the book, if available, with stripped HTML tags', function(){
      
    })
    it('should create an object for the list of chapters in the book', function(){
      
    })
    it('should create an object for a total list of JSON for the book, if available', function(){
      
    })
    it('should create an object for the zip file url for the book, if available', function(){
      
    })
  })
})