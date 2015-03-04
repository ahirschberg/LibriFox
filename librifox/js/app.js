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

// TODO Get JS to recognize multiple HTML pages
// Once this is fixed, playing books + settings should work!

// Bugs:
//    -Not loading when spaces are used
//    -Not working with multiple pages
//    -Search results aren't resetting
$( document ).on( "pagecreate", "#chaptersListPage", function( event ) {
  // TODO: Load the ID of the book
  var id = localStorage.getItem("id");
  getJSON("https://librivox.org/api/feed/audiobooks/id/" + encodeURIComponent(id) + "?&format=json", function(xhr){
    var book = xhr.response.books[0];
    var timesecs = xhr.response.books[0].totaltimesecs;
    var time = xhr.response.books[0].totaltime;
    $("#audioTime").attr("max", parseInt(timesecs)).slider("refresh");
    // -- Initialize Get RSS --
    getXML("https://librivox.org/rss/" + encodeURIComponent(id), function(xhr){
      var xml = xhr.response;
      var xmlDoc = $.parseXML( xml );
      var newXML = $( xmlDoc );
      var title = newXML.find( "title" );
      var enclosure = newXML.find("enclosure");
      var currTitle;
      var currEnclosure;
      $.each(title, function(index){
        currTitle = title[index].innerHTML;
        // Replace unnecessary CDATA characters
        currTitle = currTitle.replace("<![CDATA[", "").replace("]]>", "");
        var chapterItem = $('<li chapter-id=' + index + '><a href="book.html"><h2>' + currTitle + '</h2></a></li>');
        chapterItem.click(function(){
              chapter_index = $(this).attr("chapter-id");
              localStorage.setItem("index", chapter_index);
          console.log("Stored index as " + chapter_index);
        });
        $("#chaptersList").append(chapterItem);
        
      });
      $("#chaptersList").listview('refresh');
      // Title is an array. It can be accessed via title[0], where 0 is the first chapters' name.
      // Each sound file can be accessed in a similar way, using the tag enclosure. The URL is included in this tag.
      // Note: These are taking a long time (~12-15secs) to complete. We should find a better way of storing these URLs - maybe a database?
    });
    
  //  $("#audioSource").attr("src", ) -> Setting Audio Source, once hosted
 //   $("#audioTime").slider("option", "0", timesecs);
  });
});
$( document ).on( "pagecreate", "#homeBook", function( event ){
  var currIndex = localStorage.getItem("index");
  var id = localStorage.getItem("id");
    getJSON("https://librivox.org/api/feed/audiobooks/id/" + encodeURIComponent(id) + "?&format=json", function(xhr){
      var book = xhr.response.books[0];
      var timesecs = xhr.response.books[0].totaltimesecs;
      var time = xhr.response.books[0].totaltime;
      $("#audioTime").attr("max", parseInt(timesecs)).slider("refresh");
      // -- Initialize Get RSS --
      getXML("https://librivox.org/rss/" + encodeURIComponent(id), function(xhr){
      var xml = xhr.response;
      var xmlDoc = $.parseXML( xml );
      var newXML = $( xmlDoc );
      var title = newXML.find( "title" ); // This is the "official" chapter title
        var bookTitle = localStorage.getItem("title");
      var enclosure = newXML.find("enclosure");
      var currTitle = title[currIndex].innerHTML.replace("<![CDATA[", "").replace("]]>", "");
      var currEnclosure = enclosure[currIndex];
      var url = $(currEnclosure).attr("url");// We no longer need to loop through enclosures or the index, we have that now!
        console.log("You are trying to read " + bookTitle + ": " + currTitle + " on chapter " + currIndex + " with URL " + url);
      // Title is an array. It can be accessed via title[0], where 0 is the first chapters' name.
      // Each sound file can be accessed in a similar way, using the tag enclosure. The URL is included in this tag.
      // Note: These are taking a long time (~12-15secs) to complete. We should find a better way of storing these URLs - maybe a database?
    });
      
  $("#audioTime").on("change", function(){
    var currTimeSeconds = $("#audioTime").val();
    var timeFormatted = intToTime(currTimeSeconds);
    $("#audioSlider .labelTime").val(timeFormatted);
    $("#audioSlider .ui-slider-handle").prop("title", timeFormatted);
  });
});
    
  //  $("#audioSource").attr("src", ) -> Setting Audio Source, once hosted
 //   $("#audioTime").slider("option", "0", timesecs);
});
$( document ).on( "pagecreate", "#homeSettings", function( event ) {
  // Settings.html Loaded
});
$( document ).on( "pagecreate", "#mainIndex", function( event ) {
//  $("#booksList").empty();
  // Index.html Loaded
});
// Various used functions
function intToTime(seconds) {
    var h = Math.floor(seconds / 3600);
    seconds -= h * 3600;
    var m = Math.floor(seconds / 60);
    seconds -= m * 60;
    return h+ ":" +(m < 10 ? '0'+m : m) + ":" + (seconds < 10 ? '0'+seconds : seconds);
}
// -- Save Settings File (if nonexistent)  
function writeToSettings(key, value){
  //    if(window.localStorage){
  localStorage.setItem(key, value);
  //    }
}
//  }
function checkSettings(){
  //    if(window.localStorage){
  //if((getValue("volume") == null) || (getValue("volume") == 'undefined')){
  //  writeToSettings("volume", "60");  // -> Fix: Volume is just resetting every app restart
 // }
  //    }
}
$("#volumeSlider").change(function(){
  writeToSettings("volume", $("#volumeSlider").slider("value").val());
});

$("#newSearch").submit(function(event){
  $("#booksList").empty(); // empty the list of any results from previous searches
  var input = $("#bookSearch").val();  
  getJSON("https://librivox.org/api/feed/audiobooks/title/^" + encodeURIComponent(input) + "?&format=json",function(xhr) {
    if(typeof (xhr.response.books) === 'undefined'){
      // Show "No Available Books" text! Try making your search simpler.
      $("#noAvailableBooks").show();
    }
    else {
      console.log("librivox responded with " + xhr.response.books.length + " book(s) and status " + xhr.status);
        xhr.response.books.forEach(function(entry){
          var title = entry.title;
          var id = entry.id;
          var description = entry.description;
          var text = $.parseHTML(description);
          var realText = $(text).text();
          var id = entry.id;
          if(title != ''){
            bookListItem = $('<li book-id=' + id + '><a href="chapters.html"><h2>' + title + '</h2><p>' + realText + '</p></a></li>');
            bookListItem.click(function(){
              book_id = $(this).attr("book-id");
              localStorage.setItem("id", book_id);
              localStorage.setItem("title", title);
            });
            $("#booksList").append(bookListItem);
          }
          else {
            console.log("Nothing to add!");
          }
        });
    }
    $("#booksList").listview('refresh');
  });
  return false;
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
function getXML(url, load_callback){
  var xhr = new XMLHttpRequest({ mozSystem: true });
  if (xhr.overrideMimeType) {
   // xhr.overrideMimeType('application/json');
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
  xhr.responseType = 'xml';
  xhr.send();
}