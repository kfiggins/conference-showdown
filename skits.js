/* ═══════════════════════════════════════════════════════════
   STICK-FIGURE SKITS

   One small looping scene per passage, drawn as inline SVG so it
   stays sharp at any size and ships no files.

   Two rules, both learned the hard way:

   1. A CSS `transform` on an SVG element OVERRIDES its `transform`
      attribute. So positioning and animation never live on the same
      element: an outer <g> carries transform="translate(...)" and an
      inner <g> carries the animation class.
   2. Every animation runs on the same 6s loop, so beats across a scene
      stay in step. Timing lives in the keyframe percentages (see
      styles.css), not in per-element durations.

   Reverence: the Saviour is never drawn as a stick figure, and neither
   is Deity. Isaiah 53 is staged as a burden being lifted away; where the
   Lord speaks, it is light from above.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── building blocks ──────────────────────────────────── */

  /* Position something without disturbing its animation. */
  const at = (x, y, inner, s) =>
    `<g transform="translate(${x},${y})${s ? ` scale(${s})` : ''}">${inner}</g>`;

  /* A stick figure. Origin is the centre of the head; feet land at y=60. */
  const ARMS = {
    down:  'M0 17 L-11 31  M0 17 L11 31',
    out:   'M0 18 L-15 13  M0 18 L15 13',
    up:    'M0 17 L-13 1   M0 17 L13 1',
    cheer: 'M0 17 L-12 -2  M0 17 L12 -2',
    give:  'M0 18 L15 14   M0 17 L-10 31',
    point: 'M0 17 L16 7    M0 17 L-10 31',
    hold:  'M0 16 L-9 5    M0 16 L9 5',
    carry: 'M0 15 L-12 -7   M0 15 L12 -7',
    pray:  'M0 17 L-5 27   M0 17 L5 27',
    push:  'M0 18 L14 18   M0 18 L-10 30',
    reach: 'M0 18 L17 11   M0 17 L-9 30'
  };
  const LEGS = {
    stand: 'M0 34 L-10 60  M0 34 L10 60',
    walk:  'M0 34 L-13 58  M0 34 L11 60',
    kneel: 'M0 34 L-11 48 L-11 59  M0 34 L11 50',
    sit:   'M0 34 L-13 44 L-13 59  M0 34 L13 44'
  };

  function fig(o) {
    const { arms = 'down', legs = 'stand', s = 1, flip = false, hair = false } = o || {};
    const body =
      `<circle cx="0" cy="0" r="9"/>` +
      `<path d="M0 9 V34"/>` +
      `<path d="${ARMS[arms] || ARMS.down}"/>` +
      `<path d="${LEGS[legs] || LEGS.stand}"/>` +
      (hair ? `<path d="M-9 -3 Q0 -14 9 -3"/>` : '');
    const t = [flip ? 'scale(-1,1)' : '', s !== 1 ? `scale(${s})` : ''].filter(Boolean).join(' ');
    return t ? `<g transform="${t}">${body}</g>` : body;
  }

  const heart = (s = 1) =>
    `<path transform="scale(${s})" d="M0 8 C-9 1 -9 -7 -4 -7 C-1 -7 0 -4 0 -3 C0 -4 1 -7 4 -7 C9 -7 9 1 0 8 Z"/>`;
  const book = (w = 30) =>
    `<path d="M${-w} -10 L0 -6 L${w} -10 L${w} 12 L0 16 L${-w} 12 Z"/><path d="M0 -6 V16"/>`;
  const coin = (r = 6) => `<circle cx="0" cy="0" r="${r}"/><path d="M0 ${-r + 2} V${r - 2}"/>`;
  const rays = (n = 7, r1 = 16, r2 = 30) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * (i / (n - 1))) - Math.PI;   // a fan across the top
      d += `M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)} ` +
           `L${(Math.cos(a) * r2).toFixed(1)} ${(Math.sin(a) * r2).toFixed(1)} `;
    }
    return `<path d="${d}"/>`;
  };
  /* Light falling from above — how the Lord's voice is shown. */
  const beam = (w = 34, h = 66) =>
    `<path d="M${-w / 2} 0 L${w / 2} 0 L${w} ${h} L${-w} ${h} Z" fill="currentColor" opacity=".07" stroke="none"/>` +
    `<path class="sk-glow" d="M${-w / 2} 0 L${-w} ${h} M0 0 V${h} M${w / 2} 0 L${w} ${h}" stroke-dasharray="5 7"/>`;
  const cloud = () =>
    `<path d="M-30 8 A12 12 0 0 1 -21 -11 A16 16 0 0 1 3 -20 A14 14 0 0 1 24 -8` +
    ` A11 11 0 0 1 30 8 Z"/>`;
  const speech = (n = 3) => {
    let d = '';
    for (let i = 0; i < n; i++) { const r = 8 + i * 8; d += `M${r} ${-r * 0.6} A${r} ${r} 0 0 1 ${r} ${r * 0.6} `; }
    return `<path d="${d}"/>`;
  };
  const chainLink = () => `<ellipse cx="0" cy="0" rx="8" ry="5.5"/>`;
  const noFood = () =>
    `<path d="M-19 -3 A19 19 0 0 0 19 -3 Z"/><path d="M-24 -3 H24"/>` +
    `<circle cx="0" cy="-1" r="27"/><path d="M-20 -21 L20 19"/>`;
  const sack = () =>
    `<path d="M-17 -46 Q0 -57 17 -46 L36 -8 Q42 8 22 11 H-22 Q-42 8 -36 -8 Z"/>` +
    `<path d="M-17 -46 Q0 -37 17 -46"/>` +
    `<circle cx="-13" cy="-14" r="6"/><circle cx="5" cy="-6" r="7"/><circle cx="20" cy="-16" r="5"/>`;
  const loaf = () =>
    `<path d="M-22 0 Q-22 -17 0 -17 Q22 -17 22 0 Z"/><path d="M-11 -14 V-3 M0 -16 V-3 M11 -14 V-3"/>`;
  const temple = () =>
    `<path d="M-48 28 H48 M-42 28 V22 H42 V28"/>` +
    `<path d="M-35 22 V-2 M-21 22 V-2 M-7 22 V-2 M7 22 V-2 M21 22 V-2 M35 22 V-2"/>` +
    `<path d="M-46 -2 H46 L31 -17 H-31 Z"/>` +
    `<path d="M0 -17 V-41"/><circle cx="0" cy="-45" r="4"/>`;

  /* ── the twelve scenes ────────────────────────────────── */
  const SKITS = {

    /* Isaiah 5:20 — the labels for good and evil trade places. */
    'isa-5-20': `
      ${at(74, 92, `<g class="sk-swap-a">
        <rect x="-38" y="-38" width="76" height="76" rx="7"/>
        <path d="M-17 3 L-4 17 L18 -14" stroke-width="6"/></g>`)}
      ${at(326, 92, `<g class="sk-swap-b">
        <rect x="-38" y="-38" width="76" height="76" rx="7"/>
        <path d="M-15 -15 L15 15 M15 -15 L-15 15" stroke-width="6"/></g>`)}
      ${at(200, 150, `<g class="sk-bob">${fig({ arms: 'out' })}</g>`)}
      ${at(200, 76, `<g class="sk-flip"><path d="M-52 0 A52 52 0 0 1 52 0"/>
        <path d="M43 -13 L54 2 L38 7"/></g>`)}`,

    /* Isaiah 29:13-14 — a marvellous work: the record rises with light. */
    'isa-29-13': `
      ${at(200, 106, `<g class="sk-rise-hold">
        <g class="sk-glow">${rays(13, 62, 98)}</g>${book(58)}</g>`)}
      ${at(66, 148, `<g class="sk-bob">${fig({ arms: 'cheer' })}</g>`)}
      ${at(334, 148, `<g class="sk-bob" style="--d:-2s">${fig({ arms: 'cheer', hair: true })}</g>`)}`,

    /* Isaiah 53:3-5 — the burden is borne away and the man stands up.
       Nothing here depicts the Saviour; the lifting is shown, not the Lifter. */
    'isa-53-3': `
      ${at(174, 56, `<g class="sk-glow">${rays(11, 32, 52)}</g>`)}
      ${at(174, 148, `<g class="sk-straighten">${fig({ arms: 'carry' })}</g>`)}
      ${at(174, 124, `<g class="sk-lift-away"><g transform="scale(1.15)">${sack()}</g></g>`)}
      ${at(322, 154, `<g class="sk-in" style="--d:2.8s">${heart(2.6)}</g>`)}
      ${at(200, 210, `<path d="M-160 0 H160"/>`)}`,

    /* Isaiah 58:6-7 — the fast: food set aside, bread given, the yoke broken. */
    'isa-58-6': `
      ${at(92, 132, `<g class="sk-bob">${fig({ arms: 'give', s: 1.1 })}</g>`)}
      ${at(96, 54, `<g class="sk-slide-out"><g transform="scale(1.2)">${noFood()}</g></g>`)}
      ${at(200, 140, `<g class="sk-in" style="--d:1.4s"><g transform="scale(1.25)">${loaf()}</g></g>`)}
      ${at(320, 134, `<g class="sk-bob" style="--d:-1.5s">${fig({ arms: 'reach', flip: true, s: .92 })}</g>`)}
      ${at(206, 198, `<g><g class="sk-break-l">${at(-22, 0, chainLink())}${at(-42, 0, chainLink())}${at(-62, 0, chainLink())}</g>
        <g class="sk-break-r">${at(22, 0, chainLink())}${at(42, 0, chainLink())}${at(62, 0, chainLink())}</g></g>`)}`,

    /* Isaiah 58:13-14 — the seventh day, and the week's business set down. */
    'isa-58-13': `
      ${at(200, 44, `<g>${[0, 1, 2, 3, 4, 5, 6].map(i =>
        at(-138 + i * 46, 0, i === 6
          ? `<g class="sk-pulse"><rect x="-17" y="-17" width="34" height="34" rx="5" fill="currentColor" opacity=".22"/><rect x="-17" y="-17" width="34" height="34" rx="5"/><path d="M-7 0 L-1 7 L8 -8"/></g>`
          : `<rect x="-17" y="-17" width="34" height="34" rx="5"/>`)).join('')}</g>`)}
      ${at(140, 136, `<g class="sk-drop"><rect x="-13" y="-14" width="26" height="24" rx="3"/><path d="M-7 -14 V-21 h14 v7"/></g>`)}
      ${at(200, 130, `<g class="sk-bob">${fig({ arms: 'cheer' })}</g>`)}
      ${at(262, 140, `<g class="sk-drop" style="--d:-.6s"><circle cx="0" cy="0" r="13"/><path d="M-13 0 h26 M0 -13 v26"/></g>`)}`,

    /* Jeremiah 1:4-5 — known before he was born. */
    'jer-1-4': `
      ${at(238, 30, `<g transform="scale(1.15)">${cloud()}</g>`)}
      ${at(238, 48, beam(44, 84))}
      ${at(238, 158, `<g class="sk-in" style="--d:1.8s">${fig({ arms: 'down', s: .8 })}</g>`)}
      ${at(238, 116, `<g class="sk-pulse">${heart(2.6)}</g>`)}
      ${at(76, 120, `<g class="sk-tick">
        <circle cx="0" cy="0" r="40"/><path d="M0 -40 v-9 M-40 0 h-9 M40 0 h9 M0 40 v9"/>
        <path class="sk-hand" d="M0 0 V-27"/></g>`)}
`,

    /* Ezekiel 3:16-17 — the watchman on the wall sounds the warning. */
    'ezek-3-16': `
      ${at(120, 196, `<path d="M-46 0 h92 M-32 0 V-80 M32 0 V-80 M-32 -40 H32 M-32 0 L32 -80 M32 0 L-32 -80"/>`)}
      ${at(120, 116, `<path d="M-54 0 H54 M-48 0 v9 M48 0 v9"/>`)}
      ${at(120, 56, `<g class="sk-bob">${fig({ arms: 'point' })}</g>`)}
      ${at(142, 58, `<g><path d="M0 0 L28 -10 L28 10 Z"/>
        <g class="sk-blast">${at(32, 0, speech(3))}</g></g>`)}
      ${at(330, 108, `<g class="sk-approach"><path d="M0 -26 L20 14 L-20 14 Z"/><path d="M0 -8 V2 M0 7 v3"/></g>`)}
      ${at(210, 196, `<g class="sk-bob" style="--d:-1.2s">
        <ellipse cx="0" cy="-10" rx="15" ry="10"/><circle cx="15" cy="-17" r="6"/>
        <path d="M-8 0 v-2 M8 0 v-2"/></g>`)}
      ${at(258, 196, `<g class="sk-bob" style="--d:-2.4s">
        <ellipse cx="0" cy="-8" rx="12" ry="8"/><circle cx="12" cy="-14" r="5"/></g>`)}`,

    /* Ezekiel 37:15-17 — two records become one in his hand. */
    'ezek-37-15': `
      ${at(200, 92, `<g class="sk-join-l">${at(-124, 0, book(40))}</g>`)}
      ${at(200, 92, `<g class="sk-join-r">${at(124, 0, book(40))}</g>`)}
      ${at(200, 100, `<g class="sk-in" style="--d:3s"><g class="sk-glow">${rays(11, 58, 88)}</g></g>`)}
      ${at(200, 176, `<g class="sk-bob">${fig({ arms: 'hold' })}</g>`)}`,

    /* Daniel 2:44-45 — the stone breaks the kingdoms; the kingdom stands. */
    'dan-2-44': `
      ${at(60, 190, `<path d="M-56 0 L0 -84 L56 0 Z"/>`)}
      ${at(0, 0, `<g class="sk-roll">${at(96, 158, `<circle cx="0" cy="0" r="19"/><path d="M-19 0 h38 M0 -19 v38"/>`)}</g>`)}
      ${at(322, 190, `<g class="sk-topple">
        <path d="M-28 0 h56"/>
        <path d="M-13 0 V-38 M13 0 V-38"/>
        <path d="M-21 -38 h42 v-38 h-42 Z"/>
        <path d="M-21 -68 L-36 -50 M21 -68 L36 -50"/>
        <circle cx="0" cy="-92" r="14"/></g>`)}
      ${at(320, 96, `<g class="sk-in" style="--d:3.4s">
        <path d="M-26 12 L-26 -12 L-13 2 L0 -16 L13 2 L26 -12 L26 12 Z"/></g>`)}`,

    /* Amos 3:7 — revealed to the prophet, who tells the people. */
    'amos-3-7': `
      ${at(96, 16, cloud())}
      ${at(96, 36, beam(24, 56))}
      ${at(96, 128, `<g class="sk-bob">${fig({ arms: 'point' })}<path d="M13 -6 V34"/></g>`)}
      ${at(132, 112, `<g class="sk-blast" style="--d:1.6s">${speech(3)}</g>`)}
      ${at(268, 150, `<g class="sk-bob" style="--d:-.8s">${fig({ arms: 'up', s: .74 })}</g>`)}
      ${at(316, 150, `<g class="sk-bob" style="--d:-1.9s">${fig({ arms: 'up', s: .74, hair: true })}</g>`)}
      ${at(364, 150, `<g class="sk-bob" style="--d:-3s">${fig({ arms: 'up', s: .74 })}</g>`)}`,

    /* Malachi 3:8-10 — one of ten given, and the windows of heaven open. */
    'mal-3-8': `
      ${at(200, 34, `<g class="sk-windows">
        <rect x="-44" y="-22" width="88" height="44" rx="4"/>
        <path d="M0 -22 V22 M-44 0 H44"/>
        <g class="sk-pane-l"><rect x="-44" y="-22" width="44" height="44" fill="currentColor" opacity=".14"/></g>
        <g class="sk-pane-r"><rect x="0" y="-22" width="44" height="44" fill="currentColor" opacity=".14"/></g>
      </g>`)}
      ${[0, 1, 2, 3].map(i =>
        at(146 + i * 36, 66, `<g class="sk-pour" style="--d:${(3.2 + i * 0.22).toFixed(2)}s">${coin(8)}</g>`)).join('')}
      ${at(200, 150, `<g class="sk-bob">${fig({ arms: 'up' })}</g>`)}
      ${at(96, 180, `<g><rect x="-26" y="-18" width="52" height="34" rx="4"/><path d="M-9 -18 h18"/></g>`)}
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i =>
        at(292 + (i % 3) * 26, 152 + Math.floor(i / 3) * 22, coin(7))).join('')}
      ${at(96, 150, `<g class="sk-tithe">${coin(7)}</g>`)}`,

    /* Malachi 4:5-6 — the hearts of the children and the fathers turn. */
    'mal-4-5': `
      ${at(200, 52, `<g class="sk-in" style="--d:.4s"><g transform="scale(1.25)">${temple()}</g></g>`)}
      ${at(74, 152, `<g class="sk-reach-r">${fig({ arms: 'reach', s: .82 })}</g>`)}
      ${at(326, 152, `<g class="sk-reach-l">${fig({ arms: 'reach', flip: true, hair: true, s: 1.05 })}</g>`)}
      ${at(200, 142, `<g class="sk-pulse">${heart(3)}</g>`)}
      ${at(200, 202, `<path d="M-140 0 H140" stroke-dasharray="7 9"/>`)}`
  };

  /* Wrap each scene in its sized, stroked canvas. */
  const FRAME = (body) =>
    `<svg class="skit-svg" viewBox="0 0 400 220" role="img" aria-label="Stick-figure scene">` +
    `<g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">` +
    body + `</g></svg>`;

  window.SKITS = Object.fromEntries(
    Object.entries(SKITS).map(([id, body]) => [id, FRAME(body)]));
})();
