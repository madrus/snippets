/* jshint -W127 */
var gulp = require('gulp');
var args = require('yargs').argv;
var browserSync = require('browser-sync');
var config = require('./gulp.config')(); // .js may be left out
var del = require('del');
var path = require('path');
var _ = require('lodash');
var $ = require('gulp-load-plugins')({
    lazy: true
});
var port = process.env.PORT || config.defaultPort;

var watchify = require('watchify');

gulp.task('help', $.taskListing);

gulp.task('default', ['help']);

gulp.task('vet', function () {
    log('VET: analysing source with JSHint and JSCS');

    return gulp
        .src(config.alljs)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jscs())
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', {
            verbose: true
        }))
        .pipe($.jshint.reporter('fail'));
});

gulp.task('fonts', ['clean-fonts'], function () {
    log('FONTS: copying fonts');

    return gulp
        .src(config.fonts)
        .pipe(gulp.dest(config.build + 'fonts'));
});

gulp.task('images', ['clean-images'], function () {
    log('IMAGES: compressing and copying images');

    return gulp
        .src(config.images)
        .pipe($.imagemin({
            optimizationLevel: 4
        })) // default is 3
        .pipe(gulp.dest(config.build + 'images'));
});

gulp.task('styles', ['clean-styles'], function () {
    log('STYLES: compiling Less --> CSS');

    return gulp
        .src(config.less)
        .pipe($.plumber())
        .pipe($.less())
        .pipe($.autoprefixer({
            browsers: ['last 2 version', '> 5%']
        }))
        .pipe(gulp.dest(config.temp));
});

gulp.task('clean', function (done) {
    var delConfig = [].concat(config.build, config.temp);
    log('CLEAN: cleaning: ' + $.util.colors.blue(delConfig));
    del(delConfig, done);
});

gulp.task('clean-fonts', function (done) {
    clean(config.build + 'fonts/**/*.*', done);
});

gulp.task('clean-images', function (done) {
    clean(config.build + 'images/**/*.*', done);
});

gulp.task('clean-styles', function (done) {
    clean(config.temp + '**/*.css', done);
});

gulp.task('clean-code', function (done) {
    var files = [].concat(
        config.temp + '**/*.js',
        config.build + '**/*.html',
        config.build + 'js/**/*.js'
    );
    clean(files, done);
});

gulp.task('less-watcher', function () {
    log('LESS-WATCHER: watching less files ');
    gulp.watch([config.less], ['styles']); // watch the dirs (1st parm) and kick the tasks (2nd parm)
});

gulp.task('template-cache', ['clean-code'], function () {
    log('TEMPLATE-CACHE: creating AngularJS $templateCache');

    return gulp
        .src(config.html)
        .pipe($.minifyHtml({
            empty: true
        })) // remove any empty tags in HTML
        .pipe($.angularTemplatecache(
            config.templateCache.file, // location of the file
            config.templateCache.options
        ))
        .pipe(gulp.dest(config.temp));
});

gulp.task('wiredep', ['vet'], function () {
    log('WIREDEP: injecting the bower css, js and our app js into the html');
    var options = config.bower;
    var wiredep = require('wiredep').stream;

    return gulp
        .src(config.index)
        .pipe(wiredep(options))
        .pipe($.inject(gulp.src(config.js), {
            read: false
        }))
        .pipe(gulp.dest(config.client));
});

gulp.task('inject', ['wiredep', 'styles', 'template-cache'], function () {
    log('INJECT: injecting our app css into the html, after WIREDEP, STYLES and TEMPLATE-CACHE');

    var templateCache = config.temp + config.templateCache.file;

    return gulp
        .src(config.index)
        .pipe($.inject(gulp.src(config.css)))
        .pipe($.inject(gulp.src(templateCache, {
            read: false
        }), {
            starttag: '<!-- inject:templates:js -->' // see index.html
        }))
        .pipe(gulp.dest(config.client));
});

gulp.task('build', ['optimize', 'fonts', 'images'], function () {
    log('BUILD: running `optimize` task and copying fonts and images');

    var msg = {
        title: 'BUILD: gulp build',
        subtitle: 'Deployed to the build folder',
        message: 'Running `gulp serve-build`'
    };
    del(config.temp);
    log(msg);
    notify(msg);
});

gulp.task('serve-specs', ['build-specs'], function(done) {
    log('SERVE-SPECS: running the spec runner');
    serve(true /* isDev */ , true /* specRunner */);
    done();
});

gulp.task('build-specs', ['template-cache'], function () {
    log('BUILD-SPECS: building the spec runner');

    var wiredep = require('wiredep').stream;
    var options = config.bower;
    var specs = config.specs;

    options.devDependencies = true;

    if (args.startServers) {
        specs = [].concat(specs, config.serverIntegrationSpecs);
    }

    return gulp
        .src(config.specRunner)
        .pipe(wiredep(options)) // inject bower files
        .pipe($.inject(gulp.src(config.testLibraries), {
            name: 'inject:testlibraries',
            read: false
        }))
        .pipe($.inject(gulp.src(config.js))) // our js files -> default injection point, no need for name
        .pipe($.inject(gulp.src(config.specHelpers), {
            name: 'inject:spechelpers',
            read: false
        }))
        .pipe($.inject(gulp.src(specs), {
            name: 'inject:specs',
            read: false
        }))
        .pipe($.inject(gulp.src(config.temp + config.templateCache.file), {
            name: 'inject:templates',
            read: false
        }))
        .pipe(gulp.dest(config.client));
});

gulp.task('optimize', ['inject', 'test'], function () {
    log('OPTIMIZE: optimizing the javascript, css, html; injecting and unit testing');

    var assets = $.useref.assets({
        searchPath: './'
    });
    var cssFilter = $.filter('**/' + config.optimized.css);
    var jsAppFilter = $.filter('**/' + config.optimized.app);
    var jsLibFilter = $.filter('**/' + config.optimized.lib);

    return gulp
        .src(config.index)
        .pipe($.plumber())
        .pipe(assets) // find all the assets
        .pipe(cssFilter) // filter down to css files only
        .pipe($.csso()) // optimize and minify the css files
        .pipe(cssFilter.restore()) // restore filter to all files
        .pipe(jsLibFilter) // filter down to lib.js file only
        .pipe($.uglify()) // minify and mangle the js files
        .pipe(jsLibFilter.restore()) // restore filter to all files
        .pipe(jsAppFilter) // filter down to app.js file only
        //.pipe($.ngAnnotate({add: true})) // adding declarations is default
        .pipe($.ngAnnotate())
        .pipe($.uglify()) // minify and mangle the js files
        .pipe(jsAppFilter.restore()) // restore filter to all files
        .pipe($.rev()) // app.js --> app-j5l4jir.js
        .pipe(assets.restore()) // concatenate them to app's and lib's
        .pipe($.useref()) // merge all links inside the index.html
        .pipe($.revReplace()) // replace the new hash tags inside index.html
        .pipe(gulp.dest(config.build))
        .pipe($.rev.manifest()) // create a manifest for the hashed files
        .pipe(gulp.dest(config.build));
});

/**
 * Bump the version
 * --type=pre will bump the prerelease version *.*.*-x
 * --type=patch or no flag will bump the patch version *.*.x
 * --type=minor will bump the minor version *.x.*
 * --type=major will bump the major version x.*.*
 * --version=1.2.3 will bump to a specific version and ignore other flags
 */
gulp.task('bump', function () {
    var msg = 'BUMP: bumping versions';
    var type = args.type;
    var version = args.version;
    var options = {};

    if (version) {
        options.version = version;
        msg += ' to ' + version;
    } else {
        options.type = type;
        msg += ' to ' + type;
    }
    log(msg);

    return gulp
        .src(config.packages)
        .pipe($.bump(options))
        .pipe($.print())
        .pipe(gulp.dest(config.root));
});

gulp.task('serve-build', ['build'], function () {
    log('SERVE-BUILD: starting serve in BUILD mode');
    serve(false /* isDev */);
});

gulp.task('serve-dev', ['inject'], function () {
    log('SERVE-BUILD: starting serve in DEV mode');
    serve(true /* isDev */);
});

gulp.task('test', ['vet', 'template-cache'], function (done) {
    startTests(true /* singleRun */ , done);
});

gulp.task('autotest', ['vet', 'template-cache'], function (done) {
    startTests(false /* continuously keep running and watching our files */ , done);
});

/////////////// FUNCTIONS \\\\\\\\\\\\\\\\\

function serve(isDev, specRunner) {
    var nodeOptions = {
        script: config.nodeServer, // app.js
        delayTime: 1, // 1 second delay
        env: {
            'PORT': port,
            'NODE_ENV': isDev ? 'dev' : 'build'
        },
        watch: [config.server] // define the files to restart on
    };

    log('FUNCTION SERVE: starting nodemon in ' + nodeOptions.env.NODE_ENV.toUpperCase() + ' mode');

    return $.nodemon(nodeOptions)
        //.on('restart', ['vet'], function (ev) { // it seems that 'vet' is not kicked off
        .on('restart', function (ev) {
            log('FUNCTION SERVE: nodemon restarted');
            log('FUNCTION SERVE: files changed on restart:\n' + ev);
            setTimeout(function () {
                browserSync.notify('FUNCTION SERVE: BrowserSync is reloading now...');
                browserSync.reload({
                    stream: false
                }); // don't pull the gulp stream (but you can if you want!)
            }, config.browserReloadDelay);
        })
        .on('start', function () {
            log('FUNCTION SERVE: nodemon started');
            startBrowserSync(isDev, specRunner);
        })
        .on('crash', function () {
            log('FUNCTION SERVE: nodemon crashed: script crashed for some reason');
        })
        .on('exit', function () {
            log('FUNCTION SERVE: nodemon exited cleanly');
        });
}

function changeEvent(event) {
    var srcPattern = new RegExp('/*(?=/' + config.source + ')/');
    log('srcPattern = ' + srcPattern);
    log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
    //    log('File ' + event.path + ' ' + event.type);
}

function notify(options) {
    var notifier = require('node-notifier');
    var notifyOptions = {
        sound: 'Bottle',
        contentImage: path.join(__dirname, 'gulp.png'),
        icon: path.join(__dirname, 'gulp.png')
    };
    _.assign(notifyOptions, options); // assign is a lodash function
    notifier.notify(notifyOptions);
}

function startBrowserSync(isDev, specRunner) {
    if (args.nosync || browserSync.active) {
        return;
    }

    log('Starting BrowserSync on port ' + port);

    if (isDev) {
        // watch the dirs (1st parm) and kick the tasks (2nd parm)
        gulp.watch([config.less], ['styles'])
            .on('change', function (event) {
                changeEvent(event);
            });
    } else {
        // watch the dirs (1st parm) and kick the tasks (2nd parm)
        gulp.watch([config.less, config.js, config.html], ['optimize', browserSync.reload])
            .on('change', function (event) {
                changeEvent(event);
            });
    }

    var options = {
        proxy: 'localhost:' + port,
        port: 3000,
        files: isDev ? [
            config.client + '**/*.*',
            '!' + config.less, // don't watch less files
            config.temp + '**/*.css'
        ] : [], // don't watch these files in build mode
        ghostMode: {
            clicks: true,
            location: true,
            forms: true,
            scroll: true
        },
        injectChanges: true, // inject changes only, otherwise everything
        logFileChanges: true,
        logLevel: 'warn', // 'debug', 'info', 'warn' or 'silent'
        logPrefix: 'BROWSERSYNC', // was initially 'gulp-patterns'
        notify: true,
        reloadDelay: 0 // reloadDelay in ms
    };

    if (specRunner) {
        options.startPath = config.specRunnerFile; // use our own specRunnerFile instead of standard html
    }

    browserSync(options);
}

function startTests(singleRun, done) {
    var child; // variable to run the forked process
    // we do require child_process and karma here because it's the only place we are going to use them
    var fork = require('child_process').fork;
    var karma = require('karma').server;
    var excludeFiles = [];
    var serverSpecs = config.serverIntegrationSpecs;

    if (args.startServers) { // gulp test --startServers
        log('FORK: starting test server');
        var savedEnv = process.env;
        savedEnv.NODE_ENV = 'dev';
        savedEnv.PORT = 8888;
        child = fork(config.nodeServer);
    } else {
        if (serverSpecs && serverSpecs.length) { // is serverSpecs are configured as an array
            excludeFiles = serverSpecs;
        }
    }

    karma.start({
        configFile: __dirname + '/karma.conf.js',
        exclude: excludeFiles,
        singleRun: !!singleRun // convert to boolean (not-not)
    }, karmaCompleted);

    // we define the function here because we'll use it only inside startTests function
    function karmaCompleted(karmaResult) {
        log('KARMA: karma completed!');
        if (child) {
            log('FORK: shutting down the child process');
            child.kill();
        }
        if (karmaResult === 1) {
            done('KARMA: tests failed with code ' + karmaResult);
        } else {
            done();
        }
    }
}

function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    del(path, done);
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
