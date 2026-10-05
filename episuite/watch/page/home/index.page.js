import '../../shared/device-polyfill'
import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { Time } from '@zos/sensor'
import { getPackageInfo } from '@zos/app'
import * as ble from '@zos/ble'
import { layout } from './index.s.layout.js'
import { MessageBuilder } from '../../shared/message'
import { SECONDS_PER_BLOCK, TOTAL_BLOCKS } from '../../utils/time'

const COLORS = {
  white: 0xffffff,
  dim: 0x94a3b8,
  accent: 0x22d3ee,
  silver: 0x64748b,
  separator: 0x334155
}

Page({
  state: {
    wakeupTime: null,
    blocks: [],
    tasks: [],
    loaded: false,
    error: null,
    widgets: null
  },

  onInit() {},

  build() {
    const w = {}
    const l = layout

    w.blockLabel = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.blockLabel,
      text: 'LOADING...',
      color: COLORS.white,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE
    })

    w.timerDisplay = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.timerDisplay,
      text: '--:--',
      color: COLORS.accent,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE
    })

    w.timerSub = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.timerSub,
      text: 'remaining',
      color: COLORS.dim,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE
    })

    w.separator = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      ...l.separator,
      color: COLORS.separator,
      radius: px(1)
    })

    w.taskLabel = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.taskLabel,
      text: '',
      color: COLORS.silver,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.ELLIPSIS
    })

    w.task1 = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.task1,
      text: '',
      color: COLORS.white,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.ELLIPSIS
    })

    w.task2 = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.task2,
      text: '',
      color: COLORS.white,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.ELLIPSIS
    })

    w.task3 = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.task3,
      text: '',
      color: COLORS.white,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.ELLIPSIS
    })

    w.task4 = hmUI.createWidget(hmUI.widget.TEXT, {
      ...l.task4,
      text: '',
      color: COLORS.white,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.ELLIPSIS
    })

    this.state.widgets = w

    this.requestDayData()

    const timeSensor = new Time()
    timeSensor.onPerMinute(() => {
      this.requestDayData()
    })
  },

  requestDayData() {
    const w = this.state.widgets
    if (!w) return

    const today = new Date()
    const dateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0')

    const { appId } = getPackageInfo()
    const mb = new MessageBuilder({ appId, appDevicePort: 20, appSidePort: 0, ble })
    mb.connect()

    mb.request({
      method: 'FETCH_DAY',
      params: { date: dateStr }
    }).then(data => {
      const { result, day } = data
      if (result === 0 && day) {
        this.state.wakeupTime = day.wakeup_time || day.wakeupTime
        this.state.blocks = day.blocks || []
        this.state.tasks = day.tasks || []
        this.state.loaded = true
        this.state.error = null
        this.refreshDisplay()
      } else if (result === -1) {
        this.state.error = 'SETUP'
        this.showSetup()
      } else {
        this.state.error = 'API error'
        this.showError()
      }
    }).catch(() => {
      this.state.error = 'connection failed'
      this.showError()
    })
  },

  refreshDisplay() {
    const w = this.state.widgets
    if (!w) return

    if (!this.state.loaded) {
      this.requestDayData()
      return
    }

    // Episuite supplies real timestamps, including fixed appointments and shifted routines.
    const timed = this.state.blocks.filter(b => b.start && b.end)
    if (timed.length) {
      const now = Date.now()
      const current = timed.find(b => now >= new Date(b.start).getTime() && now < new Date(b.end).getTime())
      const upcoming = timed.find(b => new Date(b.start).getTime() > now)
      const chosen = current || upcoming
      if (!chosen) {
        w.blockLabel.setProperty(hmUI.prop.TEXT, 'BREATHING ROOM')
        w.timerDisplay.setProperty(hmUI.prop.TEXT, '--:--')
        w.timerSub.setProperty(hmUI.prop.TEXT, 'nothing scheduled')
        this.setTasks([])
        return
      }
      const seconds = Math.max(0, Math.ceil(((current ? new Date(chosen.end) : new Date(chosen.start)).getTime() - now) / 1000))
      w.blockLabel.setProperty(hmUI.prop.TEXT, chosen.name || 'FOCUS')
      w.timerDisplay.setProperty(hmUI.prop.TEXT, String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'))
      w.timerSub.setProperty(hmUI.prop.TEXT, current ? 'remaining' : 'starts in')
      this.setTasks(chosen.tasks || [])
      return
    }

    const wakeStr = this.state.wakeupTime
    if (!wakeStr) {
      w.blockLabel.setProperty(hmUI.prop.TEXT, 'NO DATA')
      w.timerDisplay.setProperty(hmUI.prop.TEXT, '--:--')
      return
    }

    const wakeMs = new Date(wakeStr).getTime()
    const nowMs = Date.now()

    if (nowMs < wakeMs) {
      const wHour = new Date(wakeStr).getHours()
      const wMin = new Date(wakeStr).getMinutes()
      w.blockLabel.setProperty(hmUI.prop.TEXT, 'BEFORE DAY')
      w.timerDisplay.setProperty(hmUI.prop.TEXT, '--:--')
      w.timerSub.setProperty(hmUI.prop.TEXT,
        'Wake ' + String(wHour).padStart(2, '0') + ':' + String(wMin).padStart(2, '0'))
      this.setTasks([])
      return
    }

    const elapsedMs = nowMs - wakeMs
    const blockSec = SECONDS_PER_BLOCK

    const elapsedSec = Math.floor(elapsedMs / 1000)
    const blockIndex = Math.floor(elapsedSec / blockSec)

    if (blockIndex >= TOTAL_BLOCKS) {
      w.blockLabel.setProperty(hmUI.prop.TEXT, 'DAY END')
      w.timerDisplay.setProperty(hmUI.prop.TEXT, '00:00')
      w.timerSub.setProperty(hmUI.prop.TEXT, 'done')
      this.setTasks([])
      return
    }

    const secIntoBlock = elapsedSec % blockSec
    const remainingSec = blockSec - secIntoBlock

    w.blockLabel.setProperty(hmUI.prop.TEXT,
      'BLOCK ' + (blockIndex + 1))

    const minsLeft = Math.floor(remainingSec / 60)
    const secsLeft = remainingSec % 60
    const timeStr = String(minsLeft).padStart(2, '0') + ':' +
      String(secsLeft).padStart(2, '0')
    w.timerDisplay.setProperty(hmUI.prop.TEXT, timeStr)

    w.timerSub.setProperty(hmUI.prop.TEXT,
      String(minsLeft) + 'm remaining')

    const blockTasks = this.state.tasks.filter(t =>
      t.block_index === blockIndex
    )
    this.setTasks(blockTasks)
  },

  setTasks(tasks) {
    const w = this.state.widgets
    if (!w) return

    const rows = [w.task1, w.task2, w.task3, w.task4]

    if (tasks.length === 0) {
      w.taskLabel.setProperty(hmUI.prop.TEXT, 'No tasks')
      for (let i = 0; i < 4; i++) {
        rows[i].setProperty(hmUI.prop.TEXT, '')
      }
      return
    }

    w.taskLabel.setProperty(hmUI.prop.TEXT,
      String(tasks.length) + ' task' + (tasks.length !== 1 ? 's' : ''))

    for (let i = 0; i < 4; i++) {
      if (i < tasks.length) {
        const t = tasks[i]
        const icon = t.icon || ''
        const title = t.title || ''
        const combined = icon ? icon + ' ' + title : title
        rows[i].setProperty(hmUI.prop.TEXT, combined)
      } else {
        rows[i].setProperty(hmUI.prop.TEXT, '')
      }
    }
  },

  showSetup() {
    const w = this.state.widgets
    if (!w) return
    w.blockLabel.setProperty(hmUI.prop.TEXT, 'SETUP')
    w.timerDisplay.setProperty(hmUI.prop.TEXT, '--:--')
    w.timerSub.setProperty(hmUI.prop.TEXT, 'open Zepp App')
  },

  showError() {
    const w = this.state.widgets
    if (!w) return
    w.blockLabel.setProperty(hmUI.prop.TEXT, 'ERROR')
    w.timerDisplay.setProperty(hmUI.prop.TEXT, '--:--')
    w.timerSub.setProperty(hmUI.prop.TEXT, this.state.error || 'unknown')
  }
})
