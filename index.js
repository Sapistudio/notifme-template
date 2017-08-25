const path = require('path')
let juice
try {
  juice = require('juice')
} catch (error) {
  juice = null
}

function resolveObjectProperties (globalResolve, promiseObject) {
  Promise.all(Object.keys(promiseObject).map((key) => {
    return new Promise((resolve) => {
      promiseObject[key].then((promise) => resolve({key, promise}))
    })
  })).then((keyPromises) => globalResolve(keyPromises.reduce((acc, keyPromise) => {
    acc[keyPromise.key] = keyPromise.promise
    return acc
  }, {})))
}

function render (renderer, chunk, data) {
  return new Promise((resolve) => {
    if (typeof chunk === 'string') {
      Promise.resolve(renderer(chunk, data)).then(resolve)
    } else if (Array.isArray(chunk)) {
      Promise.all(chunk.map((value) => render(renderer, value, data))).then(resolve)
    } else if (chunk !== null && typeof chunk === 'object') {
      resolveObjectProperties(resolve, Object.keys(chunk).reduce((acc, key) => {
        acc[key] = render(renderer, chunk[key], data)
        return acc
      }, {}))
    } else {
      resolve(chunk)
    }
  })
}

function getTemplateFromName (templateName, folder) {
  const getTemplate = require(path.resolve(folder, templateName))
  return Promise.resolve(getTemplate())
}

function inlineCss (notif, juiceOptions) {
  if (juice && juiceOptions !== false && notif && notif.channels && notif.channels.email && notif.channels.email.html) {
    notif.channels.email.html = juice(notif.channels.email.html, Object.assign({removeStyleTags: false}, juiceOptions))
  }
  return notif
}

module.exports = (renderer, folder, options = {}) => {
  return (templateName, data) => {
    return new Promise((resolve) => {
      getTemplateFromName(templateName, folder).then((template) => {
        render(renderer, template, data).then((notification) => {
          resolve(inlineCss(notification, options.juice))
        })
      })
    })
  }
}