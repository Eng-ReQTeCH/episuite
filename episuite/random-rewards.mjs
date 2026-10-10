import {randomInt} from 'node:crypto';
export function randomUnit() { return randomInt(0, 2 ** 48 - 1) / (2 ** 48 - 1); }
// Server-only long-tail distribution: ordinary amounts vary, exceptional ones are rare.
export function coinAward(state, baseCoins, now = Date.now(), random = randomUnit) {
  if (!baseCoins || !state.settings.gamification || !state.rewardEvents?.config?.enabled) return {baseCoins,coins:baseCoins,rewardTier:'fixed'};
  const draw=random();
  if(!Number.isFinite(draw)||draw<0||draw>=1)throw new Error('Random draw must be between zero and one.');
  const coins=Math.min(5000,Math.floor(5 / (1-draw) ** .7));
  return {baseCoins,coins,rewardTier:coins>=1000?'jackpot':coins>=250?'epic':'random'};
}
