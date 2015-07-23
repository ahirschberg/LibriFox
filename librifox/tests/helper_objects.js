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
    var fake_store = {},
        callbacks = [],
        instant = false;
    return {
        getItem: function (key, callback) {
            var func = function () {
                callback(fake_store[key] || null);
            };
            
            if (instant) {
                func();
            } else {
                callbacks.push(func);
            }
        },
        setItem: function (key, value, callback) {
            fake_store[key] = value;
            callback && callback();
        },
        removeItem: function (key, callback) {
            delete fake_store[key];
            callback && callback();
        },
        length: function (callback) { // called synchronously in mock implementation
            callback(Object.keys(fake_store).length);
        },
        key: function (index, callback) {
            var func = function () {
                callback(Object.keys(fake_store)[index]);
            };
            
            if (instant) {
                func();
            } else {
                callbacks.push(func);
            }
        },
        _set_instant: function () { // sets callbacks to eval instantaneously
            instant = true;
        },
        _call_pending_callbacks: function () {
            callbacks.forEach(function (callback) {
                callback();
            });
            callbacks = [];
        },
        _reset_store: function (obj_arr) {
            instant = false;
            fake_store = obj_arr || [];
        }
    };
};

PROMISE_CATCH = (e => console.error(e.message + '\n\n', e.stack));