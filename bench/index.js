var unfurl = require('../')
var pify = require('pify')

var ogs = require('open-graph-scraper')
ogs = pify(ogs)

var debug = require('debug')('bench')

var glob = require('glob')
var microtime = require('microtime')
var _ = require('lodash')

var serve = require('serve')

// const dir = __dirname + '/../test/*.html'
// console.log('html dir', dir)

server = serve(__dirname + '/../test', {
  port: 8888
})

// var server = exec('./node_modules/.bin/http-server', ['-e', 'html'])

var files = []

console.log('cwd',  __dirname + '/../test')

glob.sync('*.html', {
  cwd: __dirname + '/../test',
}).forEach(function (file) {
  debug('file', file, '@', 'http://localhost:8888/' + file)
  files.push('http://localhost:8888/' + file)
})

files = _.flatten(Array(10).fill(files))

function bench () {
  console.log('warmed...')

  var o = file => ogs({url: file})
  var u = file => unfurl(file, { oembed: false })

  var arr1 = runner(o)
    .then(arr1 => {
      var min1 = arr1[0]
      var mean1 = arr1[1]
      var max1 = arr1[2]
      var rp1 = arr1[3]
    
    
      debug('ogs')
      debug('min', min1)
      debug('mean', mean1)
      debug('max', max1)
      debug('rp', rp1)
    })
    .then(_ => runner(u))
    .then(arr2 => {
      var min2 = arr2[0]
      var mean2 = arr2[1]
      var max2 = arr2[2]
      var rps2 = arr2[3]
    
    
      debug('unfurl')
      debug('min', min2)
      debug('mean', mean2)
      debug('max', max2)
      debug('rps', rps2)
    })
}

delay(3000)
  .then(bench)
  .then(() => server.stop('SIGHUP'))

// fn is a bound function
function runner (fn) {
  var timing = []

  var elapsed = microtime.now()

  for (var file of files) {
    try {
      var sent = microtime.now()
      fn(file) // Disable oembed otherwise unfurl would be making n^2 network requests
      .then(() => {
        var recv = microtime.now()
        var took = recv - sent
  
        timing.push(took)
      })
    } catch (err) {
      debug('ERR', err)
    }
  }

  elapsed = microtime.now() - elapsed
  elapsed = elapsed * 1e-6
  var rps = files.length / elapsed

  var min = _.min(timing) / 1000
  var mean = _.mean(timing) / 1000
  var max = _.max(timing) / 1000

  return [ min, mean, max, rps ]
}

function delay (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}
