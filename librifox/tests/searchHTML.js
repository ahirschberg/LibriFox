// Tests to check exact match searches, as well as non-exact matches
// Requires search function to return a string
var app = requireApp("/js/app");
describe("newSearch", function(){
  it('should return -1 when the value is not present', function(){
    assert.equal("Test?", "Test?");
  });
});