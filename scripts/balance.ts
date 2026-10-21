import { readFileSync } from 'node:fs';
import { runBot } from './bot';
import { DEFAULT_CONFIG } from '../src/config';
import { importConfig } from '../src/settings/configStore';

let config = DEFAULT_CONFIG;
const ci = process.argv.indexOf('--config');
if (ci >= 0) {
  const file = process.argv[ci + 1];
  if (!file) {
    console.error('--config cần đường dẫn file');
    process.exit(1);
  }
  const r = importConfig(readFileSync(file, 'utf8'));
  for (const e of r.errors) console.error(`config lỗi: ${e}`);
  config = r.config;
  console.log(`dùng config từ ${file}${r.errors.length ? ` (${r.errors.length} lỗi, giá trị sai dùng mặc định)` : ''}`);
}

const results: number[] = [];
for (let seed = 1; seed <= 20; seed++) {
  const s = runBot(seed, config);
  results.push(s.phase === 'won' ? s.config.economy.totalWaves + 1 : s.wave);
  console.log(`seed ${seed}: ${s.phase === 'won' ? 'WON' : `wave ${s.wave}`} (hp ${s.hp}, kills ${s.kills})`);
}
const avg = results.reduce((a, b) => a + b, 0) / results.length;
console.log(`average wave reached: ${avg.toFixed(2)} (won counts as ${results.length ? 16 : 0})`);
