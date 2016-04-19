/* jshint -W127 */
var gulp = require('gulp');
var config = require('./gulp.config')(); // .js may be left out
var del = require('del');
var path = require('path');
var _ = require('lodash');
var $ = require('gulp-load-plugins')({
    lazy: true
});
// make sure that watchify is installed
var watchify = require('watchify');

var port = process.env.PORT || config.defaultPort;

gulp.task('help', $.taskListing);

gulp.task('default', ['help']);

gulp.task('fonts', ['clean-fonts'], function () {
    log('FONTS: copying fonts');

    return gulp
        .src(config.fonts)
        // .pipe($.print())
        .pipe(gulp.dest(config.build + 'fonts'));
});

gulp.task('styles', ['clean-styles'], function () {
    log('STYLES: compiling LESS --> CSS');
    
    return gulp
        .src(config.less)
        .pipe($.print())
        .pipe($.plumber())
        .pipe($.less())
        .pipe($.autoprefixer({
            browsers: ['last 2 version', '> 5%']
        }))
        .pipe(gulp.dest(config.css));
});

gulp.task('clean-fonts', function (done) {
    clean(config.css + 'fonts/**/*.*', done);
});

gulp.task('clean-styles', function (done) {
    var files = [].concat(
        config.css + '**/*.css',
        config.css + '**/*.map'
    );
    clean(files, done);
});

gulp.task('watch', function () {
    log('WATCH: watching less files ');
    // watch the dirs (1st parm) and kick the tasks (2nd parm)
    gulp.watch([config.less], ['styles']); 
});

//////////////////////////////////////////////

function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    
    del(path).then(function (path) {
        done();
    });
}

function log(msg) {
    if (typeof (msg) === 'object') {
        for (var prop in msg) {
            if (msg.hasOwnProperty(prop)) {
                $.util.log($.util.colors.blue(prop + ': ' + msg[prop]));
            }
        }
    } else {
        $.util.log($.util.colors.yellow(msg));
    }
}