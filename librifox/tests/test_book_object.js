describe('Book()', function () {
    var book;
    beforeEach(function () {
        book = new Book({'json': WEB_RESP.book_json});
    });
    it('should create an instance of Book', function () {
        expect(book).instanceOf(Book); // Is this test really necessary -- seems to be testing javascript base behavior and not our code itself
    });
    it('should create an id field for the book as an integer, if available', function () {
        expect(book.id).equal(1234);
    });
    it('should create a title field for the book, if available, with stripped HTML tags', function () {
        expect(book.title).equal("Adventures of Huckleberry Finn");
    });
    it('should create a description field for the book, if available, with stripped HTML tags', function () {
        expect(book.description).equal("The Adventures of Huckleberry Finn is a novel by Mark Twain");
    });
    it('should create an object for the zip file url for the book, if available', function () {
        expect(book.fullBookUrl).equal("google.com/coolstuff.zip");
    });
});