// Sample data for tests
var CHAPTERS_ARR = [
    {
        title: 'Foreword and Contents',
        index: 0,
        url: 'http://www.example.com/gardening_00.mp3',
        position: 0
  },
    {
        title: 'Chapter 1',
        index: 1,
        url: 'http://www.example.com/gardening_01.mp3',
        position: 0
  }
];
var CHAPTER_OBJECT = CHAPTERS_ARR[0];

var WEB_RESP = {
    audio_blob: {
        size: 4001234,
        type: 'audio/mpeg'
    },
    book_json: {
        id: '1234',
        title: 'Adventures of Huckleberry Finn',
        description: 'The Adventures of Huckleberry Finn is a novel by Mark Twain',
        url_zip_file: 'google.com/coolstuff.zip'
    },
    book_xml:
        '<rss> <channel>' +
        '<item> <title><![CDATA[Chapter 01]]></title>' + // Chapter 01
        '<enclosure url="http://example.com/ch1.mp3" length="4.2MB" type="audio/mpeg" />' +
        '</item>' +
        '<item> <title><![CDATA[Chapter 02]]></title>' + // Chapter 02
        '<enclosure url="http://example.com/ch2.mp3" length="4.4MB" type="audio/mpeg" />' +
        '</item>' +
        '</channel> </rss>',
};

var BOOK_OBJECT = new Book({json: WEB_RESP.book_json});

var createFakeAsyncStorage = function () {
    var fake_store = {};
    return {
        getItem: function (key, callback) {
            callback && setTimeout(function () {
                callback(fake_store[key] || null);
            });
        },
        setItem: function (key, value, callback) {
            fake_store[key] = value;
            callback && setTimeout(callback, 0);
        },
        removeItem: function (key, callback) {
            delete fake_store[key];
            callback && setTimeout(callback, 0);
        },
        length: function (callback) {
            callback && setTimeout(() => {
                console.log('currently fake store is ', fake_store);
                callback(Object.keys(fake_store).length)
            }, 0);
        },
        key: function (index, callback) {
             callback && setTimeout(() => {
                 callback(Object.keys(fake_store)[index]);
             });
        },
        _print_store: function () {
            console.log(fake_store);
        },
        _reset_store: function (obj_arr) {
            fake_store = obj_arr || {};
        }
    };
};

var PROMISE_CATCH = (e => console.error(e.message + '\n\n', e.stack));
var PROMISE_CATCH_THROW = (e => setTimeout(() => {throw e}));