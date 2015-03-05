// DOMContentLoaded is fired once the document has been loaded and parsed,
// but without waiting for other external resources to load (css/images/etc)
// That makes the app more responsive and perceived as faster.
// https://developer.mozilla.org/Web/Reference/Events/DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {

  // We'll ask the browser to use strict code to help us catch errors earlier.
  // https://developer.mozilla.org/Web/JavaScript/Reference/Functions_and_function_scope/Strict_mode
  'use strict';

  var translate = navigator.mozL10n.get;
  var hasLoaded = localStorage.getItem("default");
  if(hasLoaded == null || hasLoaded.boolean() != true){
    localStorage.setItem("default", "true");
  }
  else {
    // Load book
    window.location = "book.html";
  }
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

// Bugs:
//    -Not loading when spaces are used
//    -Not working with multiple pages
//    -Search results aren't resetting

var currTime = 5; // I don't like having this as a global variable. It works, but TODO: change to something else
$( document ).on( "pagecreate", "#chaptersListPage", function( event ) {
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
$("#audioSource").bind("load", function(){
  console.log("Audio should have started playing by now.");
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
        console.log("Loading Audio!");
        if(localStorage.getItem("url") != null){
          console.log("Hey, you have already been here! Welcome back :)");
          var minutes = +localStorage.getItem("minutes");
          var seconds = +localStorage.getItem("seconds");
          var hours = +localStorage.getItem("hours");
          console.log("Loading your current place in the book at " + hours +  "hours, " + minutes + "minutes, " + seconds + "seconds");
          var newSeconds = seconds + (minutes * 60) + (hours * 3600); //timeToInt(hours, minutes, seconds)
          console.log("Newseconds is " + newSeconds);
          currTime = newSeconds;
        }
        $("#audioSource").prop('type', "audio/mpeg");
        $("#audioSource").prop("src", url);
        $("#audioSource").trigger('load');
    });
      
//    $("#audioTime").on("currentTime", function(){
//      var currTimeSeconds = $("#audioTime").val();
//      var timeFormatted = intToTime(currTimeSeconds);
//      $("#audioSlider .labelTime").val(timeFormatted);
//      $("#audioSlider .ui-slider-handle").prop("title", timeFormatted);
//    });
  });
});
$("#audioSource").on("timeupdate", function(){ // On audio change, save new time to localSettings
  var floatSeconds = $("#audioSource").prop('currentTime');
  var hours = +localStorage.getItem("hours");
  var minutes = +localStorage.getItem("minutes");
  var seconds = +localStorage.getItem("seconds");
  console.log(hours + ":" + minutes + ":" + seconds);
  var fullSeconds = (hours * 3600) + (minutes * 60) + seconds; // Don't know why, but this is giving a HUGE number. See console
  console.log(floatSeconds <= 5);                              // If it can be fixed, audio should be fine
  console.log(fullSeconds + " and " + (fullSeconds >= 5));
  if((floatSeconds <= 5) && (fullSeconds >= 5)){
    $("#audioSource").prop('currentTime', fullSeconds); // reset currentTime
    console.log("Should have set current time to " + fullSeconds);
  }
  else {
    var intSeconds = Math.floor(floatSeconds);
    console.log("Floatseconds is currently " + floatSeconds);
    var hours = Math.floor(intSeconds / 3600);
    intSeconds -= hours * 3600;
    var minutes = Math.floor(intSeconds / 60);
    intSeconds -= minutes * 60;
    console.log("we are now left with hours " + hours + " minutes " + minutes + " seconds " + intSeconds);
    localStorage.setItem("hours", hours);
    localStorage.setItem("minutes", minutes);
    localStorage.setItem("seconds", intSeconds);
  }
});
//$("#audioSource").on("seeking", function(){
//  console.log("Audio source was dragged by user");
//  currTime = $("#audioSource").prop('currentTime');
//  Math.floor(currTime);
//  var hours = Math.floor(currTime / 3600);
//  currTime -= hours * 3600;
//  var minutes = Math.floor(currTime / 60);
//  currTime -= minutes * 60;
//  console.log("TIME WAS CHANGED TO " + hours + " minutes " + minutes + " seconds " + currTime);
//  localStorage.setItem("hours", hours);
//  localStorage.setItem("minutes", minutes);
//  localStorage.setItem("seconds", currTime);
//}); // If a user changes the time, switch currTime to this new time, change localStorage to this as well
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
function timeToInt(hours, minutes, seconds){
  var newSeconds = 0;
  newSeconds += (hours * 3600);
  newSeconds += (minutes * 60);
  newSeconds += seconds;
}
$("#play").click(function(){
  $("#audioSource").trigger('play');
});
$("#pause").click(function(){
  $("#audioSource").trigger('pause');        
});
$("#stop").click(function(){
  $("#audioSource").trigger('stop');
});
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
              localStorage.setItem("url", "true");
              localStorage.setItem("minutes", "0");
              localStorage.setItem("seconds", "0");
              localStorage.setItem("hours", "0");
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