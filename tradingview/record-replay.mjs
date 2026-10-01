// Replays the Epiphany strategy bar by bar in TradingView and records it as a GIF.
//   node tradingview/record-replay.mjs [SYMBOL] [START_DATE] [STEPS] [OUT.gif]
// Needs TradingView running with --remote-debugging-port=9222 and the Epiphany strategy on the chart.
import { execFileSync } from 'child_process';
import fs from 'fs';
const H = '/Users/joshua/Documents/Code/_external/tradingview-mcp/src';
const { connect, evaluate, getClient } = await import(`${H}/connection.js`);
const core = await import(`${H}/core/index.js`);
const [sym = 'AMEX:SPY', date = '2024-01-02', steps = '180', out = 'tradingview/replay.gif'] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await connect();
const cdp = await getClient();
const clickText = async (t) => {
  const r = await evaluate(`(function(){var b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent).find(b=>b.textContent.trim()===${JSON.stringify(t)});if(!b)return null;var r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  if (r) for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp.Input.dispatchMouseEvent({ type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  return !!r;
};
const seen = t => evaluate(`document.body.innerText.includes(${JSON.stringify(t)})`);
// Replay leaves a saved session behind; TradingView then asks "Continue your last replay?" and wants a date.
async function settleDialogs() {
  if (await seen('Continue your last replay?')) { await clickText('Start new'); await sleep(1200); }
  if (await seen('Select date')) {
    const box = await evaluate(`(function(){var i=[...document.querySelectorAll('input')].filter(e=>e.offsetParent).find(e=>/^\\d{4}-\\d{2}-\\d{2}$/.test(e.value));if(!i)return null;var r=i.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    if (box) {
      for (const type of ['mousePressed', 'mouseReleased']) await cdp.Input.dispatchMouseEvent({ type, x: box.x, y: box.y, button: 'left', clickCount: 3 });
      await cdp.Input.insertText({ text: date });
      await sleep(300);
    }
    await clickText('Select');
    await sleep(2500);
  }
}
try { await core.replay.stop(); } catch {}
await sleep(1000);
await settleDialogs();
for (let i = 0; i < 3; i++) {  // symbol switches sometimes don't stick on the first try
  await core.chart.setSymbol({ symbol: sym });
  await sleep(3000);
  if ((await core.chart.getState()).symbol === sym) break;
}
await core.chart.setTimeframe({ timeframe: 'D' });
await sleep(2000);
console.log('chart', (await core.chart.getState()).symbol);
try { await core.replay.start({ date }); } catch (e) { console.log('start', e.message); }
await sleep(2500);
await settleDialogs();
console.log('replay at', JSON.stringify(await core.replay.status()).slice(0, 200));
const dir = fs.mkdtempSync('/tmp/epiphany-replay-');
const shot = async n => {
  const r = await core.capture.captureScreenshot({ region: 'chart', filename: `replay-${String(n).padStart(4, '0')}` });
  fs.renameSync(r.file_path, `${dir}/${String(n).padStart(4, '0')}.png`);
};
let n = 0;
try {
  for (let i = 0; i < Number(steps); i++) {
    await core.replay.step();
    if (i % 2 === 0) await shot(n++);
  }
  console.log('status', JSON.stringify(await core.replay.status()).slice(0, 300));
} finally {
  await core.replay.stop();
}
execFileSync('magick', ['-delay', '10', '-loop', '0', `${dir}/*.png`, '-resize', '1100x', '-layers', 'Optimize', out]);
console.log('frames', n, 'gif', out, (fs.statSync(out).size / 1e6).toFixed(1) + 'MB');
process.exit(0);
