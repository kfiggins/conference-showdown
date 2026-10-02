#!/usr/bin/env node
/*
 * Builds data/world-land.json: the world's coastlines as one SVG path, for
 * the "Where in the world?" round. Source is Natural Earth's 1:110m land
 * (public domain). Equirectangular: x = longitude + 180, y = 90 − latitude,
 * so the map's viewBox is 0 0 360 150 (Antarctica is cropped off).
 * Run once; the output is committed.
 */
import { writeFileSync } from 'node:fs';
const SRC = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
const geo = await (await fetch(SRC)).json();
const r = v => Math.round(v * 4) / 4;                 // quarter-degree grid
let d = '', rings = 0, pts = 0;
for (const f of geo.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) {
    if (ring.every(([, lat]) => lat < -60)) continue;   // Antarctica
    const out = [];
    for (const [lon, lat] of ring) {
      const p = [r(lon + 180), r(90 - Math.max(lat, -60))];
      const q = out[out.length - 1];
      if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
    }
    if (out.length < 4) continue;
    d += 'M' + out.map(p => p.join(' ')).join('L') + 'Z';
    rings++; pts += out.length;
  }
}
writeFileSync(new URL('../data/world-land.json', import.meta.url),
  JSON.stringify({ source: SRC, license: 'Natural Earth — public domain', viewBox: '0 0 360 150', d }) + '\n');
console.log(`data/world-land.json: ${rings} land shapes, ${pts} points, ${Math.round(d.length / 1024)} KB`);
