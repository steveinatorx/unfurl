require("babel-polyfill")

const get = require('lodash.get')
const set = require('lodash.set')
const camelCase = require('lodash.camelcase')

const fetch = require('node-fetch')
const htmlparser2 = require('htmlparser2')

const ogp = require('./lib/ogp')
const twitter = require('./lib/twitter')
const oembed = require('./lib/oembed')

const debug = require('debug')('unfurl')

const shouldRollup = [
  'og:image',
  'twitter:image',
  'twitter:player',
  'og:video',
  'og:audio'
]

unfurl('http://facebook.com')
  .then(x => console.log('GOODGOOD', x))
  .catch(err => console.log('BADBAD', err))

function unfurl (url, init) {
  debug('\n\n :::: unfurl ::::\n\n')

  init = init || {}

  const pkgOpts = {
    ogp: get(init, 'ogp', true),
    twitter: get(init, 'twitter', true),
    oembed: get(init, 'oembed', true),
    other: get(init, 'other', true)
  }

  const fetchOpts = {
    timeout: get(init, 'timeout', 2000),
    follow: get(init, 'follow', 5),
    compress: get(init, 'compress', true)
  }

  return fetch(url, fetchOpts)
    .then(res => res.body)
    .then(res => handleStream(res, pkgOpts)) // TODO compose these fns better.
    .then(res => postProcess(res, pkgOpts)) // TODO compose these fns better.
}

function handleStream (res, pkgOpts) {
  return new Promise((resolve, reject) => {
    debug('\n\n :::: handleStream ::::\n\n')

    const parser = new htmlparser2.Parser({
      onopentag,
      ontext,
      onclosetag,
      onerror,
      onopentagname
    }, {decodeEntities: true})

    const pkg = {}
    res.pipe(parser)

    function onopentagname (tag) {
      // debug('<' + tag + '>')

      this._tagname = tag
    }

    function onerror (err) {
      debug('error', err)
      reject(err)
    }

    function ontext (text) {
      if (this._tagname === 'title' && pkgOpts.other) {
        set(pkg, 'other.title', get(pkg, 'other.title', '') + text)
      }
    }

    function onopentag (name, attr) {
      const prop = attr.property || attr.name || attr.rel
      const val = attr.content || attr.value || attr.href

      if (!prop) return

      debug(prop + '=' + val)

      if (pkgOpts.oembed && attr.type === 'application/json+oembed') {
        pkg.oembed = attr.href
        return
      }

      if (!val) return

      let target

      if (pkgOpts.ogp && ogp.includes(prop)) {
        target = (pkg.ogp || (pkg.ogp = {}))
      } else if (pkgOpts.twitter && twitter.includes(prop)) {
        target = (pkg.twitter || (pkg.twitter = {}))
      } else {
        target = (pkg.other || (pkg.other = {}))
      }

      rollup(target, prop, val)
    }

    function onclosetag (tag) {
      debug('</' + tag + '>')

      this._tagname = ''

      if (tag === 'head') {
        debug('GOT HEAD. SHOULD STOP NOW')

        parser.end()
        parser.reset() // Parse as little as possible.

        res.unpipe(parser)
        res.resume()

        if (typeof res.destroy === 'function') {
          res.destroy()
        }

      }

      // debug('res', res)
    }

    res.on('response', function (res) {
      const headers = res.headers

      const contentType = get(headers, 'content-type', '')

      // Abort if content type is not text/html or constient
      if (!contentType.includes('html')) {
        // parser.pause()
        res.pause()
        res.unpipe(parser)
        parser._parser.reset() // Parse as little as possible.
        set(pkg, 'other._type', contentType)
      }
    })

    res.on('data', () => {
      debug('GOT SOME DATA')
    })

    res.once('end', () => {
      debug('ENDED')
      resolve(pkg)
    })

    res.once('error', (err) => {
      debug('ERRD', err.message)
      reject(err)
    })
  })
}

function rollup (target, name, val) {
  debug('\n\n :::: rollup ::::\n\n')

  if (!name || !val) return

  let rollupAs = shouldRollup.find(function (k) {
    return name.startsWith(k)
  })

  if (rollupAs) {
    let namePart = name.slice(rollupAs.length)
    let prop = !namePart ? 'url' : camelCase(namePart)
    rollupAs = camelCase(rollupAs)
    target = (target[rollupAs] || (target[rollupAs] = [{}]))

    let last = target[target.length - 1]
    last = (last[prop] ? (target.push({}) && target[target.length - 1]) : last)
    last[prop] = val

    return
  }

  const prop = camelCase(name)
  target[prop] = val
}

function postProcess (pkg, pkgOpts) {
  debug('\n\n :::: postProcess ::::\n\n')

  const keys = [
    'ogp.ogImage',
    'twitter.twitterImage',
    'twitter.twitterPlayer',
    'ogp.ogVideo'
  ]

  for (const key of keys) {
    let val = get(pkg, key)
    if (!val) continue

    val = val.sort((a, b) => a.width - b.width) // asc sort

    set(pkg, key, val)
  }

  if (pkgOpts.oembed && pkg.oembed) {
    return fetch(pkg.oembed)
      .then(res => res.json())
      .then(oembedData => {
        const unwind = get(oembedData, 'body', oembedData)

        // Even if we don't find valid oembed data we'll return an obj rather than the url string
        pkg.oembed = {}

        for (const [k, v] of Object.entries(unwind)) {
          const camelKey = camelCase(k)
          if (!oembed.includes(camelKey)) {
            continue
          }

          pkg.oembed[camelKey] = v
        }

        return pkg
      })
  }

  debug('DONEZO')
  return Promise.resolve(pkg)
}

module.exports = unfurl
