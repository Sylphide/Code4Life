var gulp = require("gulp");
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');
var babelify = require('babelify');
var browserify = require('browserify');

var bundler = browserify('src/main.js');
bundler.transform(babelify);

gulp.task("default", function() {
  bundler.bundle()
    .on('error', function (err) { console.error(err); })
    .pipe(source('script.js'))
    .pipe(buffer())
    .pipe(gulp.dest('dist'));
});
