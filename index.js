const protocol = require('hypercore-protocol')
const pump = require('pump')

module.exports = createProxyStream

function exec (feed, n, m) {
  switch (n) {
    case 2: return feed.info(m)
    case 3: return feed.have(m)
    case 4: return feed.unhave(m)
    case 5: return feed.want(m)
    case 6: return feed.unwant(m)
    case 7: return feed.request(m)
    case 8: return feed.cancel(m)
    case 9: return feed.data(m)
  }
}

function createProxyStream (key, opts) {
  if (!opts) opts = {}

  const proxies = []
  const contentProxies = []
  const stream = opts.stream || protocol(opts)
  const feed = stream.feed(key)
  const contentFeed = stream.feed(Buffer.from('40261e1bd9f1eb543c7a18de1b68b77a3a6d729625d519d7b8d1411e6acf6d0a', 'hex'))

  // missing info since that is stateful and handshake cause we only allow one

  feed.on('have', execProxy(3))
  feed.on('unhave', execProxy(4))

  // TODO: reenable these, and don't just send a [0, Inf] want message
  // feed.on('want', execProxy(5))
  // feed.on('unwant', execProxy(6))

  feed.on('request', execProxy(7))
  feed.on('cancel', execProxy(8))
  feed.on('data', execProxy(9))

  contentFeed.on('have', execContentProxy(3))
  contentFeed.on('unhave', execContentProxy(4))

  // TODO: reenable these, and don't just send a [0, Inf] want message
  // contentFeed.on('want', execContentProxy(5))
  // contentFeed.on('unwant', execContentProxy(6))

  contentFeed.on('request', execContentProxy(7))
  contentFeed.on('cancel', execContentProxy(8))
  contentFeed.on('data', execContentProxy(9))

  return {stream, proxy}

  function execProxy (n) {
    return function (m) {
      for (const f of proxies) exec(f, n, m)
    }
  }

  function execContentProxy (n) {
    return function (m) {
      for (const f of contentProxies) exec(f, n, m)
    }
  }

  function execMain (n) {
    return function (m) {
      exec(feed, n, m)
    }
  }

  function execMainContent (n) {
    return function (m) {
      exec(contentFeed, n, m)
    }
  }

  function proxy (otherStream, proxyOpts) {
    if (!proxyOpts) proxyOpts = {}
    const otherProtocol = proxyOpts.stream || protocol(opts)
    const otherFeed = otherProtocol.feed(key)
    const otherContentFeed = otherProtocol.feed(Buffer.from('40261e1bd9f1eb543c7a18de1b68b77a3a6d729625d519d7b8d1411e6acf6d0a', 'hex'))

    proxies.push(otherFeed)
    contentProxies.push(otherContentFeed)

    // See above TODO
    otherFeed.want({start: 0, length: 0})
    otherFeed.on('have', execMain(3))
    otherFeed.on('unhave', execMain(4))
    otherFeed.on('want', execMain(5))
    otherFeed.on('unwant', execMain(6))
    otherFeed.on('request', execMain(7))
    otherFeed.on('cancel', execMain(8))
    otherFeed.on('data', execMain(9))

    otherContentFeed.want({start: 0, length: 0})
    otherContentFeed.on('have', execMainContent(3))
    otherContentFeed.on('unhave', execMainContent(4))
    otherContentFeed.on('want', execMainContent(5))
    otherContentFeed.on('unwant', execMainContent(6))
    otherContentFeed.on('request', execMainContent(7))
    otherContentFeed.on('cancel', execMainContent(8))
    otherContentFeed.on('data', execMainContent(9))

    pump(otherStream, otherProtocol, otherStream, done)

    function done () {
      proxies.splice(proxies.indexOf(otherFeed), 1)
      contentProxies.splice(contentProxies.indexOf(otherContentFeed), 1)
    }
  }
}
