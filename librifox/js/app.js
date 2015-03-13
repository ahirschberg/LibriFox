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
  if(Boolean(localStorage.getItem("default")) != true){
    localStorage.setItem("default", "true"); // Set default settings
    localStorage.setItem("directoryCreated", "false");
  }
//  if(hasLoaded == null || Boolean(hasLoaded) != true){
//    localStorage.setItem("default", "true");
//  }
//  else {
    // Load book
//    window.location = "book.html";
//  }
});

// Bugs:
//    -Not loading when spaces are used
//    -Not working with multiple pages
//    -Search results aren't resetting
//    -Slider not refreshing on page view

// ------- TODO LIST -------
// Set audioManager SRC to downloaded file, also add delete buttons to listView -- 
// Delete is the .delete function of the DeviceStorage API
// Add directories for each book, show downloaded files as a list of directories

var currTime = 5; // I don't like having this as a global variable. It works, but TODO: change to something else

$( document ).on( "pageinit", "#chaptersListPage", function( event ) {
  var id = localStorage.getItem("id");
  getJSON("https://librivox.org/api/feed/audiobooks/id/" + encodeURIComponent(id) + "?&format=json", function(xhr){
   
    // TODO write a JSON parse method so that we don't have ugly stuff like this sitting around
    var timesecs = xhr.response.books[0].totaltimesecs;
    $("#audioTime").attr("max", parseInt(timesecs)).slider("refresh");
    
    getXML("https://librivox.org/rss/" + encodeURIComponent(id), function(xhr){
      var xml = $(xhr.response);
      var titles = xml.find("title");
      titles.each(function(index){
        cdata_regex = /^<!\[CDATA\[(.*)\]\]>$/;
        var title = cdata_regex.exec($(this).text())[1] // the text inside the <CDATA[[]]> is returned at index 1
        var chapterListItem = $('<li chapter-id=' + index + '><a href="book.html"><h2>' + title + '</h2></a></li>');
        chapterListItem.click(function(){
              chapter_index = $(this).attr("chapter-id");
              localStorage.setItem("index", chapter_index); // TODO change localstorage to Book object
        });
        $("#chaptersList").append(chapterListItem);
      });
      $("#chaptersList").listview('refresh');
    });
  });
});

$("#audioSource").bind("load", function(){
  console.log("Audio should have started playing by now.");
});

function Book(args)
{
  this.json = args.json;
}

$( document ).on( "pageinit", "#homeBook", function( event ){
  $(".ui-slider-input").hide();
  $(".ui-slider-handle").hide();
  $("#downloadProgress").val(0).slider("refresh");
  $("#downloadFullBook").click(function(){
    var URL = localStorage.getItem("download");
    downloadBook(URL);
  });
  $("#downloadPart").click(function(){
    var URL = localStorage.getItem("bookURL");
    downloadBook(URL);
  });
  var currIndex = localStorage.getItem("index");
  var id = localStorage.getItem("id");
    getJSON("https://librivox.org/api/feed/audiobooks/id/" + encodeURIComponent(id) + "?&format=json", function(xhr){
      var book = xhr.response.books[0];
      var timesecs = xhr.response.books[0].totaltimesecs;
      var time = xhr.response.books[0].totaltime;
      $("#audioTime").attr("max", parseInt(timesecs)).slider("refresh");
      // -- Initialize Get RSS --
      getXML("https://librivox.org/rss/" + encodeURIComponent(id), function(xhr){
        var xml = $(xhr.response);
        var title = xml.find( "title" ); // This is the "official" chapter title
        var bookTitle = localStorage.getItem("title");
        var enclosure = xml.find("enclosure");
        var currTitle = title[currIndex].innerHTML.replace("<![CDATA[", "").replace("]]>", "");
        var currEnclosure = enclosure[currIndex];
        var url = $(currEnclosure).attr("url");// We no longer need to loop through enclosures or the index, we have that now!
        localStorage.setItem("bookURL", url);
        console.log("You are trying to read " + bookTitle + ": " + currTitle + " on chapter " + currIndex + " with URL " + url);
        console.log("Loading Audio!");

        $("#audioSource").prop('type', "audio/mpeg");
        $("#audioSource").prop("src", url);
        $("#audioSource").trigger('load');
    });
  });
});

$( document ).on( "pageinit", "#homeFileManager", function(){ // TODO work only in LibriFox directory
  var sdcard = navigator.getDeviceStorage('sdcard');
  var request = sdcard.enumerate();
  request.onsuccess = function(){
    if(this.result){ // Todo list isn't determining different list items
      fileListItem = $('<li><a data-icon="delete">' + this.result.name + '</a></li>');     
// Options and menus to display info?
//<select data-native-menu="false" name="fileSelect"><option data-placeholder="true" value="main-name">Name of file</option></select>      
      fileListItem.click(function(){
        console.log("You clicked on " + $(this).text());
      });
      fileListItem.on("taphold", function(){
        console.log("Taphold on " + $(this).text());
        // Open up menu to save, rename, delete
      })
      $("#downloadedFiles").append(fileListItem);
      this.continue();
    };
    $("#downloadedFiles").listview('refresh');
  };
  request.onerror = function(){
    console.log("No data found on SDCard!");
    $("#noAvailableDownloads").show();
  }
});
$("#audioSource").on("timeupdate", function(){ // On audio change, save new time to localSettings
  var floatSeconds = $("#audioSource").prop('currentTime');
  var hours = +localStorage.getItem("hours");
  var minutes = +localStorage.getItem("minutes");
  var seconds = +localStorage.getItem("seconds");
  console.log(hours + ":" + minutes + ":" + seconds);
  var fullSeconds = (hours * 3600) + (minutes * 60) + seconds;
  console.log(floatSeconds <= 5);
  console.log(fullSeconds + " and " + (fullSeconds >= 5));
  if((floatSeconds <= 5) && (fullSeconds >= 5)){
    $("#audioSource").prop('currentTime', fullSeconds);
  }
  else {
    var intSeconds = Math.floor(floatSeconds);
    console.log("Floatseconds is currently " + floatSeconds);
    var hours = Math.floor(intSeconds / 3600);
    intSeconds -= hours * 3600;
    var minutes = Math.floor(intSeconds / 60);
    intSeconds -= minutes * 60;
    localStorage.setItem("hours", hours);
    localStorage.setItem("minutes", minutes);
    localStorage.setItem("seconds", intSeconds);
  }
});
//$( document ).on( "pageinit", "#homeSettings", function( event ) {
  // Settings.html Loaded
//});
//$( document ).on( "pageinit", "#mainIndex", function( event ) {
//  $("#booksList").empty();
  // Index.html Loaded
//});

// Various used functions

function intToTime(seconds) {
    var h = Math.floor(seconds / 3600);
    seconds -= h * 3600;
    var m = Math.floor(seconds / 60);
    seconds -= m * 60;
    return h+ ":" +(m < 10 ? '0'+m : m) + ":" + (seconds < 10 ? '0'+seconds : seconds);
}

function downloadProgress(event){
    if(event.lengthComputable){
      var percentage = (event.loaded / event.total) * 100;
      $("#downloadProgress").val(percentage).slider('refresh');
      console.log("Downloading... " + percentage + "%");
    }
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
function downloadBook(URL){
  var id = localStorage.getItem("id");
  console.log("URL determined to be " + URL);
  var sdcard = navigator.getDeviceStorage("sdcard");
//    var download = $.get(URL);
  getBlob(URL, function(xhr){
    var filename = URL.substring(URL.lastIndexOf('/')+1);
    sdcard.addNamed(xhr.response, filename);
  });
}
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
          var downloadURL = entry.url_zip_file;
          var realText = $(text).text();
          var id = entry.id;
          if(title != ''){
            bookListItem = $('<li book-id=' + id + '><a href="chapters.html"><h2>' + title + '</h2><p>' + realText + '</p></a></li>');
            bookListItem.click(function(){
              book_id = $(this).attr("book-id");
              localStorage.setItem("id", book_id);
              localStorage.setItem("title", title);
              localStorage.setItem("download", downloadURL);
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
function getDataFromUrl(url, type, load_callback) // NEEDS MORE MAGIC STRINGS
{
  var xhr = new XMLHttpRequest({ mozSystem: true });

  if (xhr.overrideMimeType && type == 'json') {
    xhr.overrideMimeType('application/json');
  }

  var error_callback = function(e) {
    console.log("error loading json from url " + url);
    console.log(e);
  }
  var updateProgress = function(event){
    downloadProgress(event);
  };
  xhr.addEventListener('load', function(e) {
    load_callback(xhr,e);
  });

  xhr.addEventListener('error', error_callback);
  xhr.addEventListener('timeout', error_callback);
  xhr.addEventListener('progress', updateProgress);
//  xhr.upload.addEventListener("load", transferComplete, false);
//  xhr.upload.addEventListener("error", transferFailed, false);
//  xhr.upload.addEventListener("abort", transferCanceled, false);
  xhr.open('GET', url);
  if (type != 'default') { xhr.responseType = type; }
  xhr.send();
}
function getJSON(url, load_callback) { getDataFromUrl(url, 'json', load_callback); }
function getXML(url, load_callback)  { getDataFromUrl(url, 'default',  load_callback); }
function getBlob(url, load_callback) { getDataFromUrl(url, 'blob', load_callback); }