'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var bench = function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
    var o, u, _ref2, _ref3, min1, mean1, max1, rp1, _ref4, _ref5, min2, mean2, max2, rps2;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return delay(3000);

          case 2:
            // Wait for http server to warm up

            console.log('warmed...');

            o = function o(file) {
              return ogs({ url: file });
            };

            u = function u(file) {
              return unfurl(file, { oembed: false });
            };

            _context.next = 7;
            return runner(o);

          case 7:
            _ref2 = _context.sent;
            _ref3 = _slicedToArray(_ref2, 4);
            min1 = _ref3[0];
            mean1 = _ref3[1];
            max1 = _ref3[2];
            rp1 = _ref3[3];

            debug('ogs');
            debug('min', min1);
            debug('mean', mean1);
            debug('max', max1);
            debug('rp', rp1);

            _context.next = 20;
            return runner(u);

          case 20:
            _ref4 = _context.sent;
            _ref5 = _slicedToArray(_ref4, 4);
            min2 = _ref5[0];
            mean2 = _ref5[1];
            max2 = _ref5[2];
            rps2 = _ref5[3];

            debug('unfurl');
            debug('min', min2);
            debug('mean', mean2);
            debug('max', max2);
            debug('rps', rps2);

          case 31:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function bench() {
    return _ref.apply(this, arguments);
  };
}();

// fn is a bound function
var runner = function () {
  var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(fn) {
    var timing, elapsed, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, file, sent, recv, took, rps, min, mean, max;

    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            timing = [];
            elapsed = microtime.now();
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context2.prev = 5;
            _iterator = files[Symbol.iterator]();

          case 7:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context2.next = 24;
              break;
            }

            file = _step.value;
            _context2.prev = 9;
            sent = microtime.now();
            _context2.next = 13;
            return fn(file);

          case 13:
            // Disable oembed otherwise unfurl would be making n^2 network requests
            recv = microtime.now();
            took = recv - sent;


            timing.push(took);
            _context2.next = 21;
            break;

          case 18:
            _context2.prev = 18;
            _context2.t0 = _context2['catch'](9);

            debug('ERR', _context2.t0);

          case 21:
            _iteratorNormalCompletion = true;
            _context2.next = 7;
            break;

          case 24:
            _context2.next = 30;
            break;

          case 26:
            _context2.prev = 26;
            _context2.t1 = _context2['catch'](5);
            _didIteratorError = true;
            _iteratorError = _context2.t1;

          case 30:
            _context2.prev = 30;
            _context2.prev = 31;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 33:
            _context2.prev = 33;

            if (!_didIteratorError) {
              _context2.next = 36;
              break;
            }

            throw _iteratorError;

          case 36:
            return _context2.finish(33);

          case 37:
            return _context2.finish(30);

          case 38:

            elapsed = microtime.now() - elapsed;
            elapsed = elapsed * 1e-6;
            rps = files.length / elapsed;
            min = _.min(timing) / 1000;
            mean = _.mean(timing) / 1000;
            max = _.max(timing) / 1000;
            return _context2.abrupt('return', [min, mean, max, rps]);

          case 45:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[5, 26, 30, 38], [9, 18], [31,, 33, 37]]);
  }));

  return function runner(_x) {
    return _ref6.apply(this, arguments);
  };
}();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var unfurl = require('../');
var pify = require('pify');

var ogs = require('open-graph-scraper');
ogs = pify(ogs);

var debug = require('debug')('bench');

var glob = require('glob');
var microtime = require('microtime');
var _ = require('lodash');

var serve = require('serve');

// const dir = __dirname + '/../test/*.html'
// console.log('html dir', dir)

server = serve(__dirname + '/../test', {
  port: 8888
});

// let server = exec('./node_modules/.bin/http-server', ['-e', 'html'])

var files = [];

console.log('cwd', __dirname + '/../test');

glob.sync('*.html', {
  cwd: __dirname + '/../test'
}).forEach(function (file) {
  debug('file', file, '@', 'http://localhost:8888/' + file);
  files.push('http://localhost:8888/' + file);
});

files = _.flatten(Array(10).fill(files));

bench().then(function () {
  return server.stop('SIGHUP');
});

function delay(ms) {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, ms);
  });
}