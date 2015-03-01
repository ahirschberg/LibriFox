// DOMContentLoaded is fired once the document has been loaded and parsed,
// but without waiting for other external resources to load (css/images/etc)
// That makes the app more responsive and perceived as faster.
// https://developer.mozilla.org/Web/Reference/Events/DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {

  // We'll ask the browser to use strict code to help us catch errors earlier.
  // https://developer.mozilla.org/Web/JavaScript/Reference/Functions_and_function_scope/Strict_mode
  'use strict';

  var translate = navigator.mozL10n.get;
  checkSettings();
  // We want to wait until the localisations library has loaded all the strings.
  // So we'll tell it to let us know once it's ready.
  //navigator.mozL10n.once(start);

  // ---

  /*function start() {

    var message = document.getElementById('message');

    // We're using textContent because inserting content from external sources into your page using innerHTML can be dangerous.
    // https://developer.mozilla.org/Web/API/Element.innerHTML#Security_considerations
    message.textContent = translate('message');

  }*/
});


// BIG ERROR! As soon as a request is made, ALL lists reset. It's almost as if the page is refreshing. This is our issue!


// -- THE FOLLOWING CODE IS AN EXAMPLE TO SHOW THAT LISTS DO NOT WORK PROPERLY --

$('#addTestText').click(function() {
    var newAmount = $('#testText').val();

    if(newAmount != '') {
      $('#booksList').append('<li><a>' + newAmount + '</a></li>').listview('refresh');
      $('#testText').val('');
    } else {
        alert('Nothing to add');   
    }
});

// -- END TEST CODE --

  var volumeAmt = getValue("volume");
  
  // -- Save Settings File (if nonexistent)  
  function writeToSettings(key, value){
//    if(window.localStorage){
      localStorage.setItem(key, value);
//    }
  }
  function getValue(key){
//    if(window.localStorage){
      localStorage.getItem(key);
    }
//  }
  function checkSettings(){
//    if(window.localStorage){
      if((getValue("volume") == null) || (getValue("volume") == 'undefined')){
        writeToSettings("volume", "60");  // -> Fix: Volume is just resetting every app restart
      }
//    }
  }
// TODO Check how to save localStorage
  $("#volumeSlider").change(function(){
    // Set volume variable in settings
    writeToSettings("volume", $("#volumeSlider").slider("value").val());
  });
  $("#newSearch").submit(function(){
    var input = encodeURIComponent( $("#bookSearch").val() );
    var url = ("https://librivox.org/api/feed/audiobooks/title/^" + input + "?&format=json");
    var json = getJSON("https://librivox.org/api/feed/audiobooks/title/^" + input + "?&format=json",function(xhr) {
      console.log(xhr); // this works :)
      // onLoad Callback... display results!
      console.log(xhr.response);
      console.log(xhr.response.books);
      xhr.response.books.forEach(function(entry){
        var title = entry.title;
       // var value = title.val();
        if(title != ''){
          $("#booksList").append('<li><a>' + title + '</a></li>').listview('refresh');  // EVEN NO REFRESH WILL RESET ITEMS!
        }
        else {
          console.log("Nothing to add!");
        } // It appended... but it didn't show. Refresh doesn't work.
        // Add object to Linked ListView (see JQuery Mobile) -- DONE... but list isn't refreshing :(
        // For each object, change link to book -- ALMOST? Just an A tag with HREF
        // onClick -> go to book.html, which has play buttons, etc. together, load audiobook
      });
    });
  });
function getJSON(url, load_callback) {
  var xhr = new XMLHttpRequest({ mozSystem: true });
  if (xhr.overrideMimeType) {
    xhr.overrideMimeType('application/json');
  }

  var callback = function(e) {
    console.log("error loading json from url " + url);
    console.log(e);
  }
  xhr.addEventListener('load', function(e) {
    load_callback(xhr,e);
  });

  xhr.addEventListener('error', callback);
  xhr.addEventListener('timeout', callback);
  xhr.open('GET', url);
  xhr.responseType = 'json';
  xhr.send();
}
