
var fs = require('fs');
var path = require('path');
var Cleancss = require('clean-css');
var cssnext = require('cssnext');
var cssstats = require('cssstats');
var filesize = require('filesize');
var postcss = require('postcss');
var reporter = require('postcss-reporter');
var removeComments = require('postcss-discard-comments');

var removeRoot = postcss.plugin('remove-root', function() {
  return function(root) {
    root.walkRules(function(rule) {
      if (rule.selector === ':root') {
        rule.remove();
      }
    });
  }
});

compile = function() {
  var src = fs.readFileSync(path.join(__dirname, 'base.css'), 'utf8');
  var dest = path.join(__dirname, '/');

  var result =
    postcss()
    .use(cssnext({
      features: {
        customProperties: {
          strict: false // disable variable fallbacks from being redundantly added
        },
        rem: false,
        pseudoElements: false,
        colorRgba: false
      }
    }))
    .use(removeComments({ removeAll: true }))
    .use(removeRoot())
    .use(cssstats())
    .use(reporter())
    .process(src)

  var css = result.css
  var minified = new Cleancss({
      advanced: false,
    }).minify(css).styles

  var stats = result.messages.filter(function (message) {
    return message.stats
  })
  .map(function (message) {
    return message.stats
  })[0]

  console.log('Size: ' + filesize(stats.size))
  console.log('Gzipped: ' + filesize(stats.gzipSize))
  console.log('Rules: ' + stats.rules.total)
  console.log('Selectors: ' + stats.selectors.total)
  console.log('Declarations: ' + stats.declarations.total)

  css =
    [
      '/*',
      '',
      '    Basscss for email-pgp',
      '    http://basscss.com',
      '',
      '    ' + filesize(stats.size),
      '    ' + filesize(stats.gzipSize) + ' Gzipped',
      '    ' + stats.rules.total + ' Rules',
      '    ' + stats.selectors.total + ' Selectors',
      '    ' + stats.declarations.total + ' Declarations',
      '    ' + Object.keys(stats.declarations.properties).length + ' Properties',
      '',
      '*/',
      '',
      '',
      css
    ].join('\n')

  fs.writeFileSync(dest + 'compiled.css', css)
  fs.writeFileSync(dest + 'compiled.min.css', minified)
  console.log('Compiled to compiled.css and compiled.min.css')

}

compile()
