export const BLOCK_DURATION_MINUTES = 15
export const SECONDS_PER_BLOCK = BLOCK_DURATION_MINUTES * 60
export const TOTAL_BLOCKS = 96

export function computeBlock(wakeMs, nowMs) {
  if (nowMs < wakeMs) return { index: -1, remainingMs: 0, elapsedMs: 0 }

  const elapsedMs = nowMs - wakeMs
  const elapsedSec = Math.floor(elapsedMs / 1000)
  const index = Math.floor(elapsedSec / SECONDS_PER_BLOCK)
  const secIntoBlock = elapsedSec % SECONDS_PER_BLOCK
  const remainingSec = SECONDS_PER_BLOCK - secIntoBlock

  return { index, remainingMs: remainingSec * 1000, elapsedMs }
}

export function formatRemaining(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
}
