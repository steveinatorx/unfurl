'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

require("babel-polyfill");

var get = require('lodash.get');
var set = require('lodash.set');
var camelCase = require('lodash.camelcase');

var fetch = require('node-fetch');
var htmlparser2 = require('htmlparser2');

var ogp = require('./lib/ogp');
var twitter = require('./lib/twitter');
var oembed = require('./lib/oembed');

var debug = require('debug')('unfurl');

var shouldRollup = ['og:image', 'twitter:image', 'twitter:player', 'og:video', 'og:audio'];

unfurl('http://crugo.com').then(function (x) {
  return console.log('GOODGOOD', x);
}).catch(function (err) {
  return console.log('BADBAD', err);
});

function unfurl(url, init) {
  debug('\n\n :::: unfurl ::::\n\n');

  init = init || {};

  var pkgOpts = {
    ogp: get(init, 'ogp', true),
    twitter: get(init, 'twitter', true),
    oembed: get(init, 'oembed', true),
    other: get(init, 'other', true)
  };

  var fetchOpts = {
    timeout: get(init, 'timeout', 2000),
    follow: get(init, 'follow', 5),
    compress: get(init, 'compress', true)
  };

  return fetch(url, fetchOpts).then(function (res) {
    return res.body;
  }).then(function (res) {
    return handleStream(res, pkgOpts);
  }).then(function (res) {
    return postProcess(res, pkgOpts);
  });
}

function handleStream(res, pkgOpts) {
  return new Promise(function (resolve, reject) {
    debug('\n\n :::: handleStream ::::\n\n');

    var parser = new htmlparser2.WritableStream({
      onopentag: onopentag,
      ontext: ontext,
      onclosetag: onclosetag,
      onerror: onerror,
      onopentagname: onopentagname
    }, { decodeEntities: true });

    var pkg = {};
    res.pipe(parser);

    function onopentagname(tag) {
      // debug('<' + tag + '>')

      this._tagname = tag;
    }

    function onerror(err) {
      debug('error', err);
      reject(err);
    }

    function ontext(text) {
      if (this._tagname === 'title' && pkgOpts.other) {
        set(pkg, 'other.title', get(pkg, 'other.title', '') + text);
      }
    }

    function onopentag(name, attr) {
      var prop = attr.property || attr.name || attr.rel;
      var val = attr.content || attr.value || attr.href;

      if (!prop) return;

      debug(prop + '=' + val);

      if (pkgOpts.oembed && attr.type === 'application/json+oembed') {
        pkg.oembed = attr.href;
        return;
      }

      if (!val) return;

      var target = void 0;

      if (pkgOpts.ogp && ogp.includes(prop)) {
        target = pkg.ogp || (pkg.ogp = {});
      } else if (pkgOpts.twitter && twitter.includes(prop)) {
        target = pkg.twitter || (pkg.twitter = {});
      } else {
        target = pkg.other || (pkg.other = {});
      }

      rollup(target, prop, val);
    }

    function onclosetag(tag) {
      // debug('</' + tag + '>')

      this._tagname = '';

      if (tag === 'head') {
        res.unpipe(parser);
        parser._destroy();
        res._destroy();
        parser._parser.reset(); // Parse as little as possible.
      }
    }

    res.on('response', function (res) {
      var headers = res.headers;

      var contentType = get(headers, 'content-type', '');

      // Abort if content type is not text/html or constient
      if (!contentType.includes('html')) {
        res.unpipe(parser);
        parser._destroy();
        res._destroy();
        parser._parser.reset(); // Parse as little as possible.
        set(pkg, 'other._type', contentType);
      }
    });

    res.on('end', function () {
      debug('parsed');
      resolve(pkg);
    });

    res.on('error', function (err) {
      debug('parse error', err.message);
      reject(err);
    });
  });
}

function rollup(target, name, val) {
  debug('\n\n :::: rollup ::::\n\n');

  if (!name || !val) return;

  var rollupAs = shouldRollup.find(function (k) {
    return name.startsWith(k);
  });

  if (rollupAs) {
    var namePart = name.slice(rollupAs.length);
    var _prop = !namePart ? 'url' : camelCase(namePart);
    rollupAs = camelCase(rollupAs);
    target = target[rollupAs] || (target[rollupAs] = [{}]);

    var last = target[target.length - 1];
    last = last[_prop] ? target.push({}) && target[target.length - 1] : last;
    last[_prop] = val;

    return;
  }

  var prop = camelCase(name);
  target[prop] = val;
}

function postProcess(pkg, pkgOpts) {

  debug('\n\n :::: postProcess ::::\n\n');

  var keys = ['ogp.ogImage', 'twitter.twitterImage', 'twitter.twitterPlayer', 'ogp.ogVideo'];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      var val = get(pkg, key);
      if (!val) continue;

      val = val.sort(function (a, b) {
        return a.width - b.width;
      }); // asc sort

      set(pkg, key, val);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  if (pkgOpts.oembed && pkg.oembed) {
    return fetch(pkg.oembed).then(function (res) {
      return res.json();
    }).then(function (oembedData) {
      var unwind = get(oembedData, 'body', oembedData);

      // Even if we don't find valid oembed data we'll return an obj rather than the url string
      pkg.oembed = {};

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = Object.entries(unwind)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var _ref = _step2.value;

          var _ref2 = _slicedToArray(_ref, 2);

          var k = _ref2[0];
          var v = _ref2[1];

          var camelKey = camelCase(k);
          if (!oembed.includes(camelKey)) {
            continue;
          }

          pkg.oembed[camelKey] = v;
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return pkg;
    });
  }

  debug('DONEZO');
  return Promise.resolve(pkg);
}

module.exports = unfurl;