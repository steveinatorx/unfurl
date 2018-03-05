'use strict'

const includes = require('lodash.includes')
const get = require('lodash.get')
const set = require('lodash.set')
const toPairs = require('lodash.topairs')
const fromPairs = require('lodash.frompairs')
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

function unfurl (url, init) {
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
    .then(handleStream(pkgOpts))
    .then(postProcess(pkgOpts))
}

function reset (res, parser) {
  debug('got reset')

  parser.end()
  parser.reset() // Parse as little as possible.

  res.unpipe(parser)
  res.resume()

  if (typeof res.destroy === 'function') {
    res.destroy()
  }
}

function handleStream (pkgOpts) {
  return res => new Promise((resolve, reject) => {
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
      debug('got open tag', tag)

      this._tagname = tag
    }

    function onerror (err) {
      debug('got parse error', err)
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

      if (pkgOpts.oembed && attr.type === 'application/json+oembed') {
        pkg.oembed = attr.href
        return
      }

      if (!val) return

      let target

      if (pkgOpts.ogp && includes(ogp, prop)) {
        target = (pkg.ogp || (pkg.ogp = {}))
      } else if (pkgOpts.twitter && includes(twitter, prop)) {
        target = (pkg.twitter || (pkg.twitter = {}))
      } else {
        target = (pkg.other || (pkg.other = {}))
      }

      rollup(target, prop, val)
    }

    function onclosetag (tag) {
      debug('got close tag', tag)

      this._tagname = ''

      if (tag === 'head') {
        reset(res, parser)
      }
    }

    res.once('response', function (res) {
      debug('got response')

      const headers = res.headers

      const contentType = get(headers, 'content-type', '')

      // Abort if content type is not text/html or constient
      if (!contentType.includes('html')) {
        reset(res, parser)
        set(pkg, 'other._type', contentType)
      }
    })

    res.once('end', () => {
      debug('got end')
      resolve(pkg)
    })

    res.once('error', (err) => {
      debug('got error', err.message)
      reject(err)
    })
  })
}

function rollup (target, name, val) {
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

function postProcess (pkgOpts) {
  return function (pkg) {
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

          const pairs = toPairs(unwind)
            .map(pair => [camelCase(pair[0]), pair[1]])
            .filter(pair => oembed.includes(pair[0]))

          pkg.oembed = fromPairs(pairs)

          return pkg
        })
    }

    return Promise.resolve(pkg)
  }
}

module.exports = unfurl
