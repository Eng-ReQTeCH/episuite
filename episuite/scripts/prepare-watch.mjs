import { cp, readFile, writeFile } from 'node:fs/promises';
const target = new URL('../watch/', import.meta.url);
await cp(new URL('../../epiblock/Smartwatch app/epiblock-watch/', import.meta.url), target, { recursive: true });
const file = new URL('page/home/index.page.js', target);
let source = await readFile(file, 'utf8');
const anchor = '    const wakeStr = this.state.wakeupTime';
source = source.replace(anchor, `    // Episuite supplies real timestamps, including fixed appointments and shifted routines.
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

` + anchor);
source = source.replace('      this.refreshDisplay()\n    })', '      this.requestDayData()\n    })');
await writeFile(file, source);
const configFile = new URL('app.json', target);
const config = JSON.parse(await readFile(configFile));
if (config.app) { config.app.appName = 'Episuite'; }
await writeFile(configFile, JSON.stringify(config, null, 2));
console.log('Episuite watch companion prepared');
