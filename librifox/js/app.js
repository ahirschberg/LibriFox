window.addEventListener('DOMContentLoaded', function() {
  'use strict';
  var translate = navigator.mozL10n.get;
});

// Bugs:
//    -Not loading when spaces are used
//    -Search results aren't resetting
//    -Slider not refreshing on page view
// COUNT HOW MANY TIMES A BOOK WAS READ

// ------- TODO LIST -------
// Set audioManager SRC to downloaded file, also add delete buttons to listView -- 
// Delete is the .delete function of the DeviceStorage API
// Add directories for each book, show downloaded files as a list of directories

var bookCache = {};
var appUIState = new UIState({'bookCache': bookCache});

function stripHTMLTags(str) {
  return str.replace(/<(?:.|\n)*?>/gm, '');
}

function Book(args) {
  this.chapters = args.chapters
  
  var  json        = args.json;
  this.description = stripHTMLTags(json.description);
  this.title       = stripHTMLTags(json.title);
  this.id          = json.id;
  this.fullBookURL = json.url_zip_file;
}

function Chapter(args) {
  title_regex = /^<!\[CDATA\[(.*)\]\]>$/;
  title_match = title_regex.exec(args.title);
  this.title  = stripHTMLTags(title_match[1] ? title_match[1] : args.title); // if regex doesn't match, fall back to raw string
  this.index  = args.index; // TODO: Add whenever this method is called, return current chapter or get it if not available
  this.url    = args.url;
  this.position = 0;
}

function UIState(args) {
  this.currentBook    = args.currentBook;
  this.currentChapter = args.currentChapter;
  this.bookCache      = args.bookCache; // to increase reausability of object - did not hard-code the coupling with our global bookCache
  
  this.setCurrentBookById = function(id) {
    this.currentBook = this.bookCache[id];
  }
  this.setCurrentChapterByIndex = function(index) {
    this.currentChapter = this.currentBook.chapters[index];
  }
}

$( document ).on( "pagecreate", "#chaptersListPage", function( event ) {
  var selectedBook = appUIState.currentBook;
  if (!selectedBook) { // selectedBook is undefined if you refresh the app from WebIDE on a chapter list page
    console.warn("Chapters List: selectedBook was undefined, which freezes the app.  Did you refresh from WebIDE?");
    return false;
  }

  var generate_chapter_list_item = function (chapter) { // is this good coding practice? local method defined inside method
    var chapterListItem = $('<li chapter-index=' + chapter.index + '><a href="book.html"><h2>' + chapter.title + '</h2></a></li>');
    chapterListItem.click(function () {
      appUIState.setCurrentChapterByIndex($(this).attr("chapter-index"));
    });
    $("#chaptersList").append(chapterListItem);
  }
  
  if (selectedBook.chapters != null) {
    $.each(selectedBook.chapters, function(index, chapter) { 
      generate_chapter_list_item(chapter);
      $("#chaptersList").listview('refresh');
    });
  } else {
    getXML("https://librivox.org/rss/" + encodeURIComponent(selectedBook.id), function(xhr) {
      var xml      = $(xhr.response),
        $items   = xml.find("item"),
        chapters = [];
      
      $items.each(function(index, element) {
        var $title = $(element).find("title")
        var $enclosure = $(element).find("enclosure");
        var chapter = new Chapter({'index': chapters.length, 'title': $title.text(), 'url': $enclosure.attr('url')})
        chapters.push(chapter);
        generate_chapter_list_item(chapter);
      });
      selectedBook.chapters = chapters;
      $("#chaptersList").listview('refresh');
    });
  }
});

$( document ).on( "pagecreate", "#homeBook", function( event ){
  $(".ui-slider-input").hide();
  $(".ui-slider-handle").hide(); // Issue here - the page isn't refreshing onLoad. As a result? Slider isn't keeping CSS values
  $("#downloadProgress").val(0).slider("refresh");
  var id = appUIState.currentBook.id;
  $("#downloadFullBook").click(function(){
    var url = appUIState.currentBook.fullBookURL;
    downloadBook(url, id);
  });
  $("#downloadPart").click(function(){
    var url = appUIState.currentChapter.url;
    downloadBook(url, id);
  });
  var url = appUIState.currentChapter.url;
  $("#audioSource").prop('type', "audio/mpeg");
  $("#audioSource").prop("src", url);
  $("#audioSource").trigger('load');
  
  $("#audioSource").on("timeupdate", function () {
    appUIState.currentChapter.position = this.currentTime;
  });
});

$( document ).on( "pagecreate", "#homeFileManager", function(){ // TODO work only in LibriFox directory
  var sdcard = navigator.getDeviceStorage('sdcard');
  var request = sdcard.enumerate();
  request.onsuccess = function(){
    if(this.result){
      fileListItem = $('<li><a data-icon="delete">' + this.result.name + '</a></li>');     
// Options and menus to display info?
//<select data-native-menu="false" name="fileSelect"><option data-placeholder="true" value="main-name">Name of file</option></select>      
      fileListItem.click(function(){
        console.log("You clicked on " + $(this).text());
      });
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
function downloadBook(URL, id) {
  var sdcard = navigator.getDeviceStorage("sdcard");
  var progress_callback = function (event) {
    if(event.lengthComputable){
      var percentage = (event.loaded / event.total) * 100;
      $("#downloadProgress").val(percentage).slider('refresh');
    }
  }

  getBlob(URL, function(xhr) {
    var filename = URL.substring(URL.lastIndexOf('/')+1);
    sdcard.addNamed(xhr.response, filename); // TODO folder with id name ie /librifox/id/
  }, {'progress_callback': progress_callback});
}
$("#newSearch").submit(function(event){
  $("#booksList").empty();
  var input = $("#bookSearch").val();
  console.log(encodeURIComponent(input));
  getJSON("https://librivox.org/api/feed/audiobooks/title/^" + encodeURIComponent(input) + "?&format=json",function(xhr) {
    if(typeof (xhr.response.books) === 'undefined'){
      $("#noAvailableBooks").show();
    }
    else {
      xhr.response.books.forEach(function(entry) {
        var book = new Book({'json': entry});
        bookCache[book.id] = book; // this ends up storing id 3 times (as key, in book object, and in book object json)
        bookListItem = $('<li book-id="' + book.id + '"><a href="chapters.html"><h2>' + book.title + '</h2><p>' + book.description + '</p></a></li>');
        bookListItem.click(function(){
          appUIState.setCurrentBookById($(this).attr("book-id"));
        });
        $("#booksList").append(bookListItem);
      });
    }
    $("#booksList").listview('refresh');
  });
  return false;
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