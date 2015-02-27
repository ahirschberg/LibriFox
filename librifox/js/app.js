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
  // An error typically occurs if a file with the same name already exists
  
  $("#test_button").click(function() {
    getJSON("https://librivox.org/api/feed/audiobooks/?id=53&format=json"); // test url
  });
  $("#volumeSlider").change(function(){
    // Set volume variable in settings
    writeToSettings("volume", $("#volumeSlider").slider("value").val());
  });

  $("#newSearch").submit(function(){
    var input = encodeURIComponent( $("#search").val() );
    //<-- Input would be searched via JSON, see website for details -->
    // Input now works
    var json = getJSON("https://librivox.org/api/feed/audiobooks/title/^" + input + "?&format=json").response;
    json.books.forEach(function(entry){
      $("#listView").append(entry.title);
      $("#listView").listView('refresh');
      
      // Add object to Linked ListView (see JQuery Mobile)
      // For each object, change link to book
      // onClick -> go to book.html, which has play buttons, etc. together
    });
  });

function getJSON(url) {
  var xhr = new XMLHttpRequest({ mozSystem: true });
  if (xhr.overrideMimeType) {
    xhr.overrideMimeType('application/json');
  }

  var callback = function(e) {
    console.log("error loading json from url " + url);
    console.log(e);
  }
  xhr.addEventListener('load', function(e) {
    //console.log("json successfully loaded from " + url);
    //console.log(xhr.response);
  });

  xhr.addEventListener('error', callback);
  xhr.addEventListener('timeout', callback);
  xhr.open('GET', url);

<<<<<<< HEAD
  xhr.responseType = 'json';
  xhr.send();

  return xhr;
}
=======
    xhr.responseType = 'json';
    xhr.send();
    
    return xhr;
  }
>>>>>>> 82a344da73513564bb18ec4e35841055e9989410
