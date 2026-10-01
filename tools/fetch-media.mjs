#!/usr/bin/env node
/*
 * Downloads the conference media onto THIS computer:
 *
 *   media/portraits/<leader>.jpg     official portraits
 *   media/audio/<talk>-<n>.mp3       three ~13-second excerpts per talk
 *   media/index.json                 what's here, read by the game
 *
 * media/ is gitignored and must stay that way: these are the Church's
 * copyrighted files, fine to use in class, not ours to republish.
 *
 * Excerpts are cut without ffmpeg. The script reads the talk's MP3 header
 * to learn its bitrate, then asks the server for just the bytes it needs
 * (an HTTP Range request) and trims the start to an MP3 frame boundary.
 * A whole talk is never downloaded.
 *
 * It also measures each excerpt's loudness 20 times a second and writes
 * data/envelopes.json — just numbers, no audio — which IS committed. The
 * online version can't analyse the Church's streamed audio (no CORS), so
 * its waveform plays these numbers back in time with the stream instead.
 * Measuring needs macOS's built-in `afconvert`; elsewhere it's skipped.
 *
 *   node tools/fetch-media.mjs           fetch what's missing
 *   node tools/fetch-media.mjs --force   fetch everything again
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = join(ROOT, 'media');
const FORCE = process.argv.includes('--force');
const EXCERPT_SECONDS = 13;
const EXCERPT_AT = [0.22, 0.45, 0.68];          // how far into the talk each excerpt starts
const UA = { 'User-Agent': 'Mozilla/5.0 (conference-showdown classroom game)' };

const json = f => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const { leaders } = json('data/leaders.json');
const conf = json('data/conference.json');

mkdirSync(join(MEDIA, 'portraits'), { recursive: true });
mkdirSync(join(MEDIA, 'audio'), { recursive: true });

/* ── MP3 frame headers ─────────────────────────────────── */
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],   // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]       // MPEG-2/2.5 Layer III
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/* Read a frame header at i, or null if it isn't one. */
function frameAt(b, i) {
  if (i + 4 > b.length || b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) return null;
  const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3;
  const bi = b[i + 2] >> 4, si = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
  if (ver === 1 || layer !== 1 || bi === 0 || bi === 15 || si === 3) return null;
  const kbps = BITRATES[ver === 3 ? 1 : 2][bi], rate = RATES[ver][si];
  const len = Math.floor((ver === 3 ? 144000 : 72000) * kbps / rate) + pad;
  return { kbps, len };
}

/* First offset where two consecutive frames line up — one lone 0xFFE
   pattern inside audio data is common; two in a row is a real frame. */
function firstFrame(b, from = 0) {
  for (let i = from; i < b.length - 4; i++) {
    const f = frameAt(b, i);
    if (f && frameAt(b, i + f.len)) return { at: i, ...f };
  }
  return null;
}

async function range(url, start, end) {
  const r = await fetch(url, { headers: { ...UA, Range: `bytes=${start}-${end}` } });
  if (r.status !== 206) throw new Error(`server ignored the byte range (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

async function excerpts(t) {
  const head = await fetch(t.audioUrl, { method: 'HEAD', headers: UA, redirect: 'follow' });
  if (!head.ok) throw new Error(`HTTP ${head.status}`);
  const size = +head.headers.get('content-length');
  if (!size) throw new Error('no file size reported');

  // Skip an ID3 tag if there is one, then read the first real frame.
  const start = await range(t.audioUrl, 0, 65535);
  let skip = 0;
  if (start.slice(0, 3).toString() === 'ID3') {
    skip = 10 + ((start[6] & 127) << 21 | (start[7] & 127) << 14 | (start[8] & 127) << 7 | (start[9] & 127));
  }
  const first = firstFrame(skip < start.length ? start : await range(t.audioUrl, skip, skip + 65535),
                           skip < start.length ? skip : 0);
  if (!first) throw new Error('could not find an MP3 frame header');

  const want = Math.ceil(first.kbps * 1000 / 8 * EXCERPT_SECONDS);
  const files = [];
  for (const [n, frac] of EXCERPT_AT.entries()) {
    const name = `${t.slug}-${n + 1}.mp3`;
    const out = join(MEDIA, 'audio', name);
    if (!FORCE && existsSync(out)) { files.push(name); continue; }
    const off = Math.floor(size * frac);
    const buf = await range(t.audioUrl, off, Math.min(size - 1, off + want + 8192));
    const f = firstFrame(buf);
    if (!f) throw new Error(`no frame boundary near ${Math.round(frac * 100)}%`);
    writeFileSync(out, buf.subarray(f.at, f.at + want));
    files.push(name);
  }
  return { files, kbps: first.kbps };
}

/* ── portraits ─────────────────────────────────────────── */
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function portrait(l) {
  const have = readdirSync(join(MEDIA, 'portraits')).find(f => f.startsWith(l.id + '.'));
  if (have && !FORCE) return have;
  const r = await fetch(l.portraitUrl, { headers: UA, redirect: 'follow' });
  const type = (r.headers.get('content-type') || '').split(';')[0];
  if (!r.ok || !EXT[type]) throw new Error(`HTTP ${r.status} ${type}`);
  const name = `${l.id}.${EXT[type]}`;
  writeFileSync(join(MEDIA, 'portraits', name), Buffer.from(await r.arrayBuffer()));
  return name;
}

/* ── go ────────────────────────────────────────────────── */
const index = { portraits: {}, clips: {} };
let problems = 0;

console.log('Portraits');
for (const l of leaders) {
  if (!l.portraitUrl) { console.log(`  -  ${l.name}: no portrait URL`); continue; }
  try { index.portraits[l.id] = await portrait(l); console.log(`  ✓  ${l.name}`); }
  catch (e) { problems++; console.log(`  ✗  ${l.name}: ${e.message}`); }
}

console.log('\nTalk excerpts');
const bare = n => n.replace(/^(President|Elder)\s+/, '');
const names = new Set(leaders.map(l => bare(l.name)));
for (const t of conf.talks) {
  // Sustaining business isn't teaching; the game doesn't use it.
  if (!t.audioUrl || t.kind === 'announcement' || !names.has(bare(t.speaker))) continue;
  try {
    const { files, kbps } = await excerpts(t);
    index.clips[t.slug] = files;
    console.log(`  ✓  ${t.slug.padEnd(20)} ${files.length} excerpts  (${kbps} kbps)`);
  } catch (e) { problems++; console.log(`  ✗  ${t.slug}: ${e.message}`); }
}

writeFileSync(join(MEDIA, 'index.json'), JSON.stringify(index, null, 2) + '\n');

/* ── loudness envelopes ────────────────────────────────── */
const ENV_RATE = 20;                       // values per second
function envelope(mp3) {
  const wav = join(tmpdir(), `cs-env-${process.pid}.wav`);
  try {
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@8000', '-c', '1', mp3, wav], { stdio: 'ignore' });
    const b = readFileSync(wav);
    let i = 12;                            // find the 'data' chunk
    while (i < b.length - 8 && b.toString('ascii', i, i + 4) !== 'data') i += 8 + b.readUInt32LE(i + 4);
    const pcm = new Int16Array(b.buffer.slice(b.byteOffset + i + 8, b.byteOffset + b.length - ((b.length - i - 8) % 2)));
    const win = 8000 / ENV_RATE, rms = [];
    for (let s = 0; s + win <= pcm.length; s += win) {
      let sum = 0;
      for (let k = s; k < s + win; k++) sum += pcm[k] * pcm[k];
      rms.push(Math.sqrt(sum / win));
    }
    // Scale so the 95th-percentile loudness reads as full height.
    const top = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.95)] || 1;
    return rms.map(v => Math.min(99, Math.round(v / top * 99)));
  } finally { rmSync(wav, { force: true }); }
}

let envelopes = null;
try { execFileSync('which', ['afconvert'], { stdio: 'ignore' }); envelopes = {}; }
catch { console.log('\nSkipping loudness envelopes: afconvert (macOS) not found.'); }
if (envelopes) {
  for (const files of Object.values(index.clips)) {
    for (const f of files) envelopes[f.replace(/\.mp3$/, '')] = envelope(join(MEDIA, 'audio', f));
  }
  writeFileSync(join(ROOT, 'data', 'envelopes.json'),
    '{\n' + Object.entries(envelopes).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
  console.log(`\ndata/envelopes.json — loudness for ${Object.keys(envelopes).length} excerpts (commit this one)`);
}
console.log(`\nmedia/index.json — ${Object.keys(index.portraits).length} portraits, ` +
            `${Object.keys(index.clips).length} talks${problems ? `, ${problems} problem(s) above` : ''}`);
