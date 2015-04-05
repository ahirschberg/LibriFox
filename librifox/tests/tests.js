// Mimic LibriVox JSON response
var BOOK_JSON = {
    "id": "59",
    "title": "Adventures of Huckleberry Finn",
    "description": "The Adventures of Huckleberry Finn is a novel by Mark Twain",
    "url_zip_file": "google.com/coolstuff.zip"
  };
var BOOK_XML =
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
    expect( stripHTMLTags('<html>no<em> html</em><garbage\n-tag> tags.') ).equal('no html tags.');
  });
  it('only removes text enclosed in brackets', function (){
    expect( stripHTMLTags('> Look, left and right angle brackets! <.') ).equal('> Look, left and right angle brackets! <.');
  });
});

describe('Book()', function () {
  it('should create an instance of Book', function () {
    expect(new Book({'json': BOOK_JSON})).instanceOf(Book); // Is this test really necessary -- seems to be testing javascript base behavior and not our code itself
  });
  it('should create an id field for the book, if available', function(){
    expect(new Book({'json': BOOK_JSON}).id).equal('59');
  });
  it('should create a title field for the book, if available, with stripped HTML tags', function(){
    expect(new Book({'json': BOOK_JSON}).title).equal("Adventures of Huckleberry Finn");
  });
  it('should create a description field for the book, if available, with stripped HTML tags', function(){
    assert.equal("The Adventures of Huckleberry Finn is a novel by Mark Twain", new Book({'json': BOOK_JSON}).description);
  });
  it('should create an object for the zip file url for the book, if available', function() {
    expect(new Book({'json': BOOK_JSON}).fullBookURL).equal("google.com/coolstuff.zip");
  });
});

describe('ChaptersListPageGenerator()', function() {
  describe('#generatePage()', function() {
    before(function () {
      var ul = $('<ul data-role="listview" id="chapters-list"></ul>');
      ul.appendTo('body');
      ul.listview(); // initializes jQuery mobile listview - necessary for #listview('refresh') within #generatePage

      function StubHttpRequestHandler() {
        this.getXML = function (url, load_callback, other_args) {
          load_callback({'response': BOOK_XML});
        }
      }

      var cpg = new ChaptersListPageGenerator({'httpRequestHandler': new StubHttpRequestHandler(), 'selector': '#chapters-list'});
      cpg.generatePage(new Book({'json':BOOK_JSON}));
    });

    it('appends chapter elements to an unordered list', function () {
      expect($('#chapters-list').children().length).equal(2);
      expect($('#chapters-list').children()[1].textContent).match(/^Chapter 02$/);
    });
    it('adds chapter-index attributes to each list item', function () {
      $('#chapters-list').children().each( function (i) {
        expect($(this).attr('chapter-index')).equal(i + ''); // need way to do a == with expect() -- expect().equal is ===
      });
    });
  });
  // Should we test private methods?  I don't think it's necessary.
});