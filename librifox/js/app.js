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
$("#volumeSlider").change(function(){
  // Set volume variable in settings
  writeToSettings("volume", $("#volumeSlider").slider("value").val());
});


$("#newSearch").submit(function(event){
  $("#booksList").empty(); // empty the list of any results from previous searches
  
  var input = $("#bookSearch").val();  
  getJSON("https://librivox.org/api/feed/audiobooks/title/^" + encodeURIComponent(input) + "?&format=json",function(xhr) {
    console.log("librivox responded with " + xhr.response.books.length + " book(s) and status " + xhr.status);
    xhr.response.books.forEach(function(entry){
      var title = entry.title;
      var id = entry.id;
      var description = entry.description;
      var text = $.parseHTML(description);
      var realText = $(text).text();
      var id = entry.id;
      if(title != ''){
        $("#booksList").append('<li><a href="book.html?id="' + id + '><h2>' + title + '</h2><p>' + realText + '</p></a></li>');
      }
      else {
        console.log("Nothing to add!");
      }
      // For each object, change link to book -- ALMOST? Just an A tag with HREF
      // onClick -> go to book.html, which has play buttons, etc. together, load audiobook
    });
    $("#booksList").listview('refresh');
  });
  return false; // this cancels the form submit, which stops the page from refreshing.
  // Awesome... I wish I had thought of that earlier :p -> Now changing search results into links which will then load the audiobook
});

function getJSON(url, load_callback) {
  var xhr = new XMLHttpRequest({ mozSystem: true });
  if (xhr.overrideMimeType) {
    xhr.overrideMimeType('application/json');
  }

  var error_callback = function(e) {
    console.log("error loading json from url " + url);
    console.log(e);
  }
  xhr.addEventListener('load', function(e) {
    load_callback(xhr,e);
  });

  xhr.addEventListener('error', error_callback);
  xhr.addEventListener('timeout', error_callback);
  xhr.open('GET', url);
  xhr.responseType = 'json';
  xhr.send();
}
