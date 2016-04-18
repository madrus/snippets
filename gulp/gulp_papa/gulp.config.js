module.exports = function () {
    var client = './src/client/';
    var clientApp = client + 'app/';
    var report = './report';
    var root = './';
    var server = './src/server/';
    var source = 'J:\/www\/ng\/papagulp\/';
    var specRunnerFile = 'specs.html';
    var temp = './.tmp/';
    var wiredep = require('wiredep'); // here: to get the list of Bower files
    var bowerFiles = wiredep({
        devDependencies: true
    })['js'];

    var config = {
        /**
         * Files paths
         */
        // all js to vet
        alljs: [
            './src/**/*.js',
            './*.js'
        ],
        build: './build/', // some people do './dist/' or'./prod/' or'./production/'
        client: client,
        css: temp + 'styles.css',
        fonts: './bower_components/font-awesome/fonts/**/*.*',
        html: clientApp + '**/*.html', // this does not hit the index.html !!!
        images: client + 'images/**/*.*',
        index: client + 'index.html',
        js: [
            clientApp + '**/*.module.js',
            clientApp + '**/*.js',
            '!' + clientApp + '**/*.spec.js' // exclude
        ],
        less: client + 'styles/styles.less',
        report: report,
        root: root,
        server: server,
        source: source,
        temp: temp,

        /**
         * optimize files
         */
        optimized: {
            app: 'app.js',
            css: '*.css',
            lib: 'lib.js'
        },

        /**
         * template cache
         */
        templateCache: {
            file: 'templates.js', // choose any name you like
            options: {
                module: 'app.core',
                standAlone: false, // it depends on the existing module 'app.core'
                root: 'app/' // for routes
            }
        },

        /**
         * browser sync
         */
        browserReloadDelay: 1000,

        /**
         * Bower and NPM locations
         */
        bower: {
            json: require('./bower.json'),
            directory: './bower_components/',
            ignorePath: '../..' // because bower_components are ../.. from index.html
        },
        packages: [
            './package.json',
            './bower.json'
        ],

        /**
         * specs.html, our HTML spec runner
         */
        specRunner: client + specRunnerFile,
        specRunnerFile: specRunnerFile,
        testLibraries: [
            'node_modules/mocha/mocha.js',
            'node_modules/chai/chai.js',
            'node_modules/mocha-clean/index.js',
            'node_modules/sinon-chai/lib/sinon-chai.js',
        ],
        specs: [clientApp + '**/*.spec.js'],

        /**
         * Karma and testing settings
         */
        specHelpers: [client + 'test-helpers/*.js'],
        serverIntegrationSpecs: [client + 'tests/server-integration/**/*.spec.js'],

        /**
         * Node settings
         */
        defaultPort: 7203,
        nodeServer: './src/server/app.js'
    };

    config.bower = getWiredepDefaultOptions();
    config.karma = getKarmaOptions();

    return config;

    ///////////////////////////////

    function getWiredepDefaultOptions() {
        return {
            bowerJson: config.bower.json,
            directory: config.bower.directory,
            ignorePath: config.bower.ignorePath
        };
    }

    function getKarmaOptions() {
        var options = {
            files: [].concat(
                bowerFiles,
                config.specHelpers,
                client + '**/*.module.js',
                client + '**/*.js', // but *.module.js first!
                temp + config.templateCache.file,
                config.serverIntegrationSpecs
            ),
            exclude: [],
            coverage: {
                dir: report + 'coverage',
                reporters: [
                    {
                        type: 'html',
                        subdir: 'report-html'
                    },
                    {
                        type: 'lcov',
                        subdir: 'report-lcov'
                    },
                    {
                        type: 'text-summary'
                    } // if we forget anything, it will be reported to console
                ]
            },
            preprocessors: {}
        };
        // ignore the specs but get the js, because you want to know the real coverage,
        // and you don't need tests for your tests :)
        options.preprocessors[clientApp + '**/!(*.spec)+(.js)'] = ['coverage'];
        return options;
    }
};
