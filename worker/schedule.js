// One cron trigger, every 15 minutes: the account is on the Workers Free cap of 5 triggers,
// so the old fixed-time jobs run off the scheduled time (UTC) instead of their own triggers.
export function cronPaths(scheduledTime) {
  const d = new Date(scheduledTime);
  const h = d.getUTCHours(), m = d.getUTCMinutes(), weekday = d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
  const paths = [];
  if (weekday && h === 8 && m === 0) paths.push('cron');                  // was '0 8 * * 1-5'
  if (weekday && h === 14 && m === 30) paths.push('broker/morning-run');  // was '30 14 * * 1-5'
  if (h === 12 && m === 0) paths.push('broker/crypto-paper');             // was '0 12 * * *': crypto trades on weekends
  if (d.getUTCDay() === 0 && h === 15 && m === 0) paths.push('earnings-digest'); // Sunday morning in Vancouver
  if (h === 21 && m === 30) paths.push('portfolio-snapshot');            // daily, after the US close
  paths.push('alerts-check');
  return paths;
}
