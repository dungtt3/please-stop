import { runBot } from './bot';

const results: number[] = [];
for (let seed = 1; seed <= 20; seed++) {
  const s = runBot(seed);
  results.push(s.phase === 'won' ? s.config.economy.totalWaves + 1 : s.wave);
  console.log(`seed ${seed}: ${s.phase === 'won' ? 'WON' : `wave ${s.wave}`} (hp ${s.hp}, kills ${s.kills})`);
}
const avg = results.reduce((a, b) => a + b, 0) / results.length;
console.log(`average wave reached: ${avg.toFixed(2)} (won counts as ${results.length ? 16 : 0})`);
