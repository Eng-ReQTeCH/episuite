export class MessageBuilder {
  constructor() {
    this.handlers = {}
    this._listenCallback = null
  }

  listen(callback) {
    this._listenCallback = callback
  }

  on(event, handler) {
    this.handlers[event] = handler
  }

  buf2json(buf) {
    if (typeof buf === 'string') {
      try { return JSON.parse(buf) } catch { return {} }
    }
    const view = new Uint8Array(buf)
    let str = ''
    for (let i = 0; i < view.length; i++) {
      str += String.fromCharCode(view[i])
    }
    try { return JSON.parse(str) } catch { return {} }
  }
}
