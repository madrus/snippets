module.exports = function () {
    var build = 'ed4u/';
    var content = build + 'Content/';

    var config = {
        css: build + 'css/',
        fonts: content + 'bootstrap/fonts/**/*.*',
        less: content + 'less/styles.less',
        /**
         * Node settings
         */
        defaultPort: 7203
    };

    return config;
};
