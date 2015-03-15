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

var bookCache = {};

// get data after ? in url, such as 45 from '/chapters.html?45' (there's most likely a more elegant solution than this for passing variables between pagecreate events)
function bookIDFromUrlAttribute(target) {
  var data_url = target.attributes['data-url'].value;
  var data = data_url.substring(data_url.lastIndexOf('?') + 1); 
  console.log(data);
  return data;
}

$( document ).on( "pagecreate", "#chaptersListPage", function( event ) {
  // $("#audioTime").attr("max", parseInt(timesecs)).slider("refresh");
  var currBook = bookCache[bookIDFromUrlAttribute(event.target)];
  if (!currBook) { // currBook is undefined if you refresh the app from WebIDE on a chapter list page
    console.warn("Chapters List: currBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
    return false;
  }

  var generate_chapter_list_item = function (chapter) { // is this good coding practice? local method defined inside method
    var chapterListItem = $('<li chapter-id=' + chapter.index + '><a href="book.html"><h2>' + chapter.title + '</h2></a></li>');
    chapterListItem.click(function (){
      chapter_index = $(this).attr("chapter-id");
      localStorage.setItem("index", chapter_index); // Still uses localstorage, needs to be updated.
    });
    $("#chaptersList").append(chapterListItem);
  }
  
  if (currBook.chapters != null) {
    console.log('currBook.chapters was not null');
    $.each(currBook.chapters, function(index, chapter) { 
      generate_chapter_list_item(chapter);
      $("#chaptersList").listview('refresh');
    });
  } else {
    console.log('currBook.chapters was null');
    getXML("https://librivox.org/rss/" + encodeURIComponent(currBook.id), function(xhr) { // get streaming urls from book's rss page
      var xml      = $(xhr.response),
        titles   = xml.find("title"),
        chapters = [];
      
      titles.each(function(index, element) {
        var chapter = new Chapter({'index': index, 'title': element.text, 'tag': element})
        chapters.push(chapter);
        generate_chapter_list_item(chapter);
      });
      currBook.chapters = chapters;
      $("#chaptersList").listview('refresh');
    });
  }
});

function Book(args) {
  this.chapters = args.chapters
  
  var  json        = args.json;
  this.json        = json;
  this.description = json.description;
  this.title       = json.title;
  this.id          = json.id;
}
function Chapter(args) {
  title_regex = /^<!\[CDATA\[(.*)\]\]>$/;
  title_match = title_regex.exec(args.title);
  this.title  = title_match[1] ? title_match[1] : args.title; // if regex doesn't match, fall back to raw string
  this.tag    = $(args.tag);
  this.index  = args.index;
}

// TODO refactor this method (it's the copy and paste version of that other method :P)
$( document ).on( "pagecreate", "#homeBook", function( event ){
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

$( document ).on( "pagecreate", "#homeFileManager", function(){ // TODO work only in LibriFox directory
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
function downloadBook(URL) {
  var id = localStorage.getItem("id");
  console.log("URL determined to be " + URL);
  var sdcard = navigator.getDeviceStorage("sdcard");
//    var download = $.get(URL);
  var progress_callback = function (event) {
    if(event.lengthComputable){
      var percentage = (event.loaded / event.total) * 100;
      $("#downloadProgress").val(percentage).slider('refresh');
      console.log("Downloading... " + percentage + "%");
    }
  }

  getBlob(URL, function(xhr) {
    var filename = URL.substring(URL.lastIndexOf('/')+1);
    sdcard.addNamed(xhr.response, filename);
  }, {'progress_callback': progress_callback});
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
        xhr.response.books.forEach(function(entry) {
          var book = new Book({'json': entry});
          bookCache[book.id] = book; // this ends up storing id 3 times (as key, in book object, and in book object json), which is a little bit icky
          bookListItem = $('<li><a href="chapters.html?'+ book.id + '"><h2>' + book.title + '</h2><p>' + book.description + '</p></a></li>');
          $("#booksList").append(bookListItem);
        });
    }
    $("#booksList").listview('refresh');
  });
  return false; // cancels form event
});
function getDataFromUrl(url, type, load_callback, other_args) // NEEDS MORE MAGIC STRINGS
{
  other_args = other_args || {};
  var xhr = new XMLHttpRequest({ mozSystem: true });

  if (xhr.overrideMimeType && type == 'json') {
    xhr.overrideMimeType('application/json');
  }

  other_args.error_callback = other_args.error_callback || function(e) {
    console.log("error loading json from url " + url);
    console.log(e);
  }
  other_args.timeout_callback = other_args.timeout_callback || function(e) {
    console.log("timeout loading json from url " + url);
    console.log(e);
  }

  xhr.addEventListener('load', function(e) {
    load_callback(xhr,e);
  });

  xhr.addEventListener('error', other_args.error_callback);
  xhr.addEventListener('timeout', other_args.timeout_callback);
  xhr.addEventListener('progress', other_args.progress_callback);
//  xhr.upload.addEventListener("load", transferComplete, false);
//  xhr.upload.addEventListener("error", transferFailed, false);
//  xhr.upload.addEventListener("abort", transferCanceled, false);
  xhr.open('GET', url);
  if (type != 'default') { xhr.responseType = type; }
  xhr.send();
}
function getJSON(url, load_callback, other_args) { getDataFromUrl(url, 'json',     load_callback, other_args); }
function getXML(url, load_callback, other_args)  { getDataFromUrl(url, 'default',  load_callback, other_args); }
function getBlob(url, load_callback, other_args) { getDataFromUrl(url, 'blob',     load_callback, other_args); }