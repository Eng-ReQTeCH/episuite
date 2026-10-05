import './device-polyfill'

let seq = 0
const pendings = {}

export class MessageBuilder {
  constructor({ appId, appDevicePort, appSidePort, ble }) {
    this.appId = appId
    this.appDevicePort = appDevicePort
    this.appSidePort = appSidePort
    this.ble = ble
    this.connected = false
    this._onData = null
  }

  connect() {
    if (this.connected) return

    const { appId, appDevicePort, appSidePort } = this

    this.ble.setAppDevicePort(appDevicePort)
    this.ble.setAppSidePort(appSidePort)

    this.ble.onConnect(() => {
      this.connected = true
    })

    this.ble.onDisconnect(() => {
      this.connected = false
    })

    this._onData = this.ble.onData((buf) => {
      try {
        const str = this._bufToString(buf)
        const msg = JSON.parse(str)
        const { _seq, _error, ...data } = msg
        const cb = pendings[_seq]
        if (cb) {
          delete pendings[_seq]
          if (_error) {
            cb.reject(new Error(_error))
          } else {
            cb.resolve(data)
          }
        }
      } catch (e) {
        console.log('MessageBuilder parse error: ' + e)
      }
    })
  }

  request(payload) {
    return new Promise((resolve, reject) => {
      const s = ++seq
      pendings[s] = { resolve, reject }

      const msg = JSON.stringify({ _seq: s, ...payload })

      try {
        this.ble.write(this.appSidePort, this._stringToBuf(msg))
      } catch (e) {
        delete pendings[s]
        reject(e)
      }

      // no timers available in Zepp OS; rely on BLE response or failure
    })
  }

  _stringToBuf(str) {
    const buf = new ArrayBuffer(str.length)
    const view = new Uint8Array(buf)
    for (let i = 0; i < str.length; i++) {
      view[i] = str.charCodeAt(i)
    }
    return buf
  }

  _bufToString(buf) {
    const view = new Uint8Array(buf)
    let str = ''
    for (let i = 0; i < view.length; i++) {
      str += String.fromCharCode(view[i])
    }
    return str
  }
}
