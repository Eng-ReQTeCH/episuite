import { MessageBuilder } from '../shared/message-side'

const messageBuilder = new MessageBuilder()

AppSideService({
  onInit() {
    messageBuilder.listen(() => {})

    messageBuilder.on('request', (ctx) => {
      const payload = messageBuilder.buf2json(ctx.request.payload)
      const { method, params } = payload

      if (method === 'FETCH_DAY') {
        this.fetchDayData(params.date, ctx)
      }
    })
  },

  fetchDayData(date, ctx) {
    const serverUrl = settingsStorage.getItem('serverUrl')

    if (!serverUrl) {
      ctx.response({ result: -1, error: 'no server URL' })
      return
    }

    const apiUrl = serverUrl.replace(/\/+$/, '') +
      '/api/v1/day?date=' + encodeURIComponent(date)

    fetch(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
      const day = data.day || data
      ctx.response({
        result: 0,
        day: {
          wakeup_time: day.wakeup_time || day.wakeupTime || null,
          blocks: day.blocks || [],
          tasks: day.tasks || []
        }
      })
    })
    .catch(err => {
      ctx.response({ result: -2, error: String(err) })
    })
  },

  onDestroy() {}
})
