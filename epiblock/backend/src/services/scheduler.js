import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);

export function calculateBlockTimes(wakeupTime, blocks) {
  if (!wakeupTime) return blocks.map(b => ({ ...b, start: null, end: null }));
  const wake = dayjs(wakeupTime);
  return blocks.map(b => {
    const start = wake.add(b.block_index * 15, 'minute');
    let end = start.add(15, 'minute');
    const tasks = b.tasks || [];
    const pinned = tasks.find(t => t.is_absolute && t.target_time);
    if (pinned) {
      const pinnedStart = dayjs(pinned.target_time);
      if (pinnedStart.isValid()) {
        return {
          ...b,
          start: pinnedStart.toISOString(),
          end: pinnedStart.add(pinned.duration_minutes || 15, 'minute').toISOString(),
          pinned: true,
        };
      }
    }
    return {
      ...b,
      start: start.toISOString(),
      end: end.toISOString(),
      pinned: false,
    };
  });
}

export function getCurrentAndNextBlocks(wakeupTime, blocks) {
  const computed = calculateBlockTimes(wakeupTime, blocks);
  const now = dayjs();
  let currentIdx = -1;
  for (let i = 0; i < computed.length; i++) {
    if (!computed[i].start) continue;
    const start = dayjs(computed[i].start);
    const end = dayjs(computed[i].end);
    if (now.isAfter(start) && now.isBefore(end)) {
      currentIdx = i;
      break;
    }
    if (now.isBefore(start)) {
      currentIdx = i - 1;
      break;
    }
  }
  if (currentIdx === -1) currentIdx = computed.length - 1;
  const result = [];
  for (let i = Math.max(0, currentIdx); i < Math.min(computed.length, currentIdx + 4); i++) {
    result.push(computed[i]);
  }
  return { currentIndex: currentIdx, blocks: result };
}

export function shiftBlocks(wakeupTime, blocks, shiftMinutes) {
  if (!wakeupTime) return blocks;
  const newWake = dayjs(wakeupTime).subtract(shiftMinutes, 'minute');
  return calculateBlockTimes(newWake.toISOString(), blocks);
}
