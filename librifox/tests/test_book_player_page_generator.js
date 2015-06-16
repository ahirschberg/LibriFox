describe('BookPlayerPageGenerator()', function () {
    var bppg, $test_div, obj_url_stub;

    before(function () {
        $test_div = $('<div/>').appendTo('body');

        bppg = new BookPlayerPageGenerator({
            'selectors': {
                'audio': '#audioSource'
            }
        });
    });

    beforeEach(function () {
        $test_div.empty();
        $('<audio id="audioSource"></audio>').appendTo($test_div);
    });

    describe('#generatePage()', function () {
        it('sets the audio element\'s src property to an object url', function () {
            bppg.generatePage('OBJECT_URL', 'chapter name');
            expect($('#audioSource').prop('src')).match(/.*\/OBJECT_URL$/);
        });
    });
});