// Karma configuration
// Generated on Mon Mar 23 2015 18:55:13 GMT-0400 (EDT)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'sinon-chai'], // I have no idea why I had to remove 'sinon' and 'chai', but now things seem to work


    // list of files / patterns to load in the browser
    files: [
      'js/jquery-2.1.3.js', // this should ensure that jquery loads before app.js, but might be unnecessary
      'jquerymobile/jquery.mobile-1.4.5.min.js',
      'js/*.js',
      'tests/*.js'
      //'tests/helper_objects.js',
      //'tests/test_book_download_manager.js'
    ],


    // list of files to exclude
    exclude: [
        'js/load_error.js',
        'tests/test_filesystem_book_reference_manager.js'
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['dots'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ["Firefox"],

    client: {
      mocha: {
        reporter: 'html', // change Karma's debug.html to the mocha web reporter
        ui: 'bdd'
      },
      captureConsole: true
    }, 

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false
  });
};
