export const rewardDefaults = { enabled: true };
export function rewardConfig(input = {}, previous = rewardDefaults) {
  const result = { enabled: previous.enabled ?? rewardDefaults.enabled };
  if ('enabled' in input) result.enabled = Boolean(input.enabled);
  return result;
}
