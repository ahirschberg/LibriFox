window.addEventListener('DOMContentLoaded', function() {
  'use strict';
  var translate = navigator.mozL10n.get;
  var hasLoaded = localStorage.getItem("default");
  if(Boolean(localStorage.getItem("default")) != true){
    localStorage.setItem("default", "true"); // Set default settings
    localStorage.setItem("directoryCreated", "false");
  }
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
var selectedBook;

$( document ).on( "pagecreate", "#chaptersListPage", function( event ) {
  if (!selectedBook) { // selectedBook is undefined if you refresh the app from WebIDE on a chapter list page
    console.warn("Chapters List: selectedBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
    return false;
  }

  var generate_chapter_list_item = function (chapter) { // is this good coding practice? local method defined inside method
    var chapterListItem = $('<li chapter-id=' + chapter.index + '><a href="book.html"><h2>' + chapter.title + '</h2></a></li>');
    chapterListItem.click(function (){
      selectedBook.currentChapter = $(this).attr("chapter-id");
    });
    $("#chaptersList").append(chapterListItem);
  }
  
  if (selectedBook.chapters != null) {
    console.log('selectedBook.chapters was not null');
    $.each(selectedBook.chapters, function(index, chapter) { 
      generate_chapter_list_item(chapter);
      $("#chaptersList").listview('refresh');
    });
  } else {
    console.log('selectedBook.chapters was null');
    getXML("https://librivox.org/rss/" + encodeURIComponent(selectedBook.id), function(xhr) { // get streaming urls from book's rss page
      var xml      = $(xhr.response),
        titles   = xml.find("title"),
        chapters = [];
      
      titles.each(function(index, element) {
        var chapter = new Chapter({'index': index, 'title': element.text, 'tag': element}) // add enclosure and URL
        chapters.push(chapter);
        generate_chapter_list_item(chapter);
      });
      selectedBook.chapters = chapters;
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
  this.currentChapter = undefined;
}
function Chapter(args) {
  title_regex = /^<!\[CDATA\[(.*)\]\]>$/;
  title_match = title_regex.exec(args.title);
  this.title  = title_match[1] ? title_match[1] : args.title; // if regex doesn't match, fall back to raw string
  this.tag    = $(args.tag);
  this.index  = args.index; // TODO: Add whenever this method is called, return current chapter or get it if not available
  this.url    = args.url;
}

// TODO refactor this method (it's the copy and paste version of that other method :P)
$( document ).on( "pagecreate", "#homeBook", function( event ){
  $(".ui-slider-input").hide();
  $(".ui-slider-handle").hide(); // Issue here - the page isn't refreshing onLoad. As a result? Slider isn't keeping CSS values
  $("#downloadProgress").val(0).slider("refresh");
  $("#downloadFullBook").click(function(){
    var URL = localStorage.getItem("download");
    downloadBook(URL);
  });
  $("#downloadPart").click(function(){
    var URL = localStorage.getItem("bookURL");
    downloadBook(URL);
  });
// get book
  var url = selectedBook.currentChapter.url;
  $("#audioSource").prop('type', "audio/mpeg");
  $("#audioSource").prop("src", url);
  $("#audioSource").trigger('load');
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
          bookListItem = $('<li book-id="' + book.id + '"><a href="chapters.html"><h2>' + book.title + '</h2><p>' + book.description + '</p></a></li>');
          bookListItem.click(function(){
            selectedBook = bookCache[$(this).attr("book-id")];
          });
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
function getBlob(url, load_callback, other_args) { getDataFromUrl(url, 'blob',     load_callback, other_args); }￿