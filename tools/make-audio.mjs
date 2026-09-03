#!/usr/bin/env node
/*
 * Pre-record the read-aloud rounds so the game plays a real audio file
 * instead of the browser's speech synthesiser.
 *
 *   node tools/make-audio.mjs                    # list the voices worth using
 *   node tools/make-audio.mjs "Ava (Premium)"    # generate every clip
 *   node tools/make-audio.mjs --scan             # rebuild index.json from audio/
 *
 * Generation uses macOS `say`, so it needs no API key and works offline.
 * Install better voices first: System Settings -> Accessibility ->
 * Spoken Content -> System Voice -> Manage Voices. See AUDIO.md.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = join(ROOT, 'audio');
const WPM = 160;                       // `say` speed; scripture reads well a little slow

const say = (...args) => execFileSync('say', args, { encoding: 'utf8' });

/* Text the synthesiser handles badly, cleaned up the same way the app does. */
const speakable = s => String(s)
  .replace(/[“”"]/g, '')
  .replace(/[‘’]/g, "'")
  .replace(/\s*…\s*/g, ', ')
  .replace(/\s*[—–]\s*/g, ', ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .replace(/,\s*,/g, ',')
  .replace(/\s+/g, ' ').trim();

function writeIndex() {
  mkdirSync(AUDIO_DIR, { recursive: true });
  const map = {};
  for (const f of readdirSync(AUDIO_DIR).sort()) {
    if (!/\.(m4a|mp3|aac|wav|aiff?|ogg)$/i.test(f)) continue;
    map[basename(f, extname(f))] = f;
  }
  writeFileSync(join(AUDIO_DIR, 'index.json'), JSON.stringify(map, null, 2) + '\n');
  const n = Object.keys(map).length;
  console.log(`audio/index.json — ${n} clip${n === 1 ? '' : 's'}`);
  return map;
}

const arg = process.argv[2];

if (arg === '--scan') {
  writeIndex();
  process.exit(0);
}

if (!arg) {
  const wanted = /\((premium|enhanced)\)|^(ava|allison|susan|zoe|evan|nathan|noelle|tom|nicky|serena|samantha|daniel|karen|moira|tessa)\b/i;
  const voices = say('-v', '?').split('\n')
    .map(l => l.match(/^(.+?)\s{2,}(\S+)/))
    .filter(m => m && /^en[_-]/i.test(m[2]))
    .map(m => ({ name: m[1].trim(), lang: m[2] }))
    .filter(v => wanted.test(v.name));

  console.log('English voices installed:\n');
  for (const v of voices) console.log(`  ${v.name.padEnd(28)} ${v.lang}`);
  const good = voices.filter(v => /\((premium|enhanced)\)/i.test(v.name));
  console.log(good.length
    ? `\n${good.length} high-quality voice(s) available. Generate with:\n  node tools/make-audio.mjs "${good[0].name}"`
    : '\nOnly the basic compact voices are installed. Read AUDIO.md before generating —' +
      '\ndownloading an Enhanced or Premium voice first makes a large difference.');
  process.exit(0);
}

const voice = arg;
const { passages } = JSON.parse(readFileSync(join(ROOT, 'data', 'passages.json'), 'utf8'));
mkdirSync(AUDIO_DIR, { recursive: true });

const jobs = [];
for (const p of passages) {
  jobs.push([p.id, p.verses.map(v => v.text).join(' ')]);
  jobs.push([`${p.id}-doctrine`, p.doctrine]);
}

console.log(`Recording ${jobs.length} clips with "${voice}" at ${WPM} wpm…\n`);
for (const [id, text] of jobs) {
  const out = join(AUDIO_DIR, `${id}.m4a`);
  say('-v', voice, '-r', String(WPM), '-o', out, '--data-format=aac', speakable(text));
  console.log(`  ${id}`);
}
console.log();
writeIndex();
console.log('\nDone. The game now plays these instead of the browser voice.');
