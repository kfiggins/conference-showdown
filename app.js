/* ═══════════════════════════════════════════════════════════
   Doctrinal Mastery Showdown
   A big-screen, two-team review game. One deck, twenty ways
   to ask the same twenty-four-ish questions.
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── little helpers ─────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const words = s => s.split(/\s+/).filter(Boolean);

const PALETTE = ['#f0b429', '#4a9be0', '#6dc86d', '#b07be0', '#e0575b', '#3fbfb0'];

const NAME_IDEAS = [
  'The Watchmen', 'Stonecutters', 'Two Sticks', 'Sabbath Delight',
  'Windows of Heaven', 'Marvellous Works', "Daniel's Lions", 'The Fiery Furnace',
  'The Remnant', "Elijah's Fire", 'Chariots of Fire', 'The Storehouse',
  'Mount Zion', 'The Sealed Book', "Isaiah's Scribes", 'The Stone Uncut',
  'Sons of Thunder', 'The Olive Branch', 'Fishers of Men', 'The Brass Plates'
];

/* ── state ──────────────────────────────────────────────── */
const S = {
  data: null,
  teams: [],
  deck: [],
  idx: 0,
  stage: 0,
  slideAwards: [],          // team indexes already awarded on this slide
  opts: { len: 16, shuffle: true, timer: true, sound: true, rounds: null, voice: '', rate: 0.85, gcShare: 0.7 },
  gc: null,                 // leaders, talks, temples, media — see loadConference()
  judgedPts: 2,
  timer: { id: null, left: 0, total: 0 },
  history: []               // { i, roundId, key, label, awards:[{team,pts}], missed }
};

/* ═══════════════════════════════════════════════════════════
   ROUND TYPES
   Each build(p, pool) returns:
     kicker  – the instruction on screen
     stages  – [html, …]; last one is the answer
     pts     – base points  |  ptsAt(stage) for sliding value
     timer   – seconds, or 0
     judged  – teacher picks 1–3 points
     speak   – text read aloud when the slide opens
   ═══════════════════════════════════════════════════════════ */

const STOP = new Set(['the', 'and', 'that', 'for', 'unto', 'his', 'her', 'our',
  'them', 'they', 'thee', 'thou', 'thy', 'thine', 'not', 'but', 'with', 'shall',
  'have', 'hath', 'will', 'was', 'are', 'you', 'him', 'this', 'his', 'into',
  'from', 'upon', 'even', 'all', 'now', 'out', 'his', 'i', 'a', 'an', 'in',
  'me', 'my', 'is', 'it', 'of', 'to', 'be', 'he', 'so', 'on', 'at', 'as']);

const NEAR_MISS = {
  delight: 'pleasure', evil: 'wrong', good: 'right', griefs: 'burdens',
  sorrows: 'sicknesses', watchman: 'shepherd', marvellous: 'wonderful',
  wonder: 'marvel', destroyed: 'shaken', kingdom: 'church', prophets: 'apostles',
  windows: 'gates', heaven: 'glory', fathers: 'mothers', children: 'youth',
  oppressed: 'captives', free: 'loose', formed: 'created', knew: 'loved',
  secret: 'counsel', revealeth: 'declareth', borne: 'lifted', hand: 'hands',
  tithes: 'offerings', prove: 'trust', sabbath: 'seventh', israel: 'judah',
  woe: 'shame', carried: 'suffered', stripes: 'wounds', healed: 'saved',
  bands: 'chains', turn: 'lift', heart: 'hearts', become: 'remain',
  loose: 'break', fast: 'feast', open: 'part', work: 'wonder', body: 'house'
};

const verseHTML = p => p.verses
  .map(v => `<span class="v-num">${v.v}</span>${esc(v.text)}`).join(' ');

function verseSizeClass(p) {
  const n = p.verses.reduce((t, v) => t + v.text.length, 0);
  return n > 620 ? 'is-xlong' : n > 300 ? 'is-long' : '';
}

const refCard = p => `
  <p class="q-ref">${esc(p.ref)}</p>
  <div class="doctrine-card"><p class="q-mid">${esc(p.doctrine)}</p></div>
  ${p.context ? `<p class="q-sub">${esc(p.context)}</p>` : ''}`;

/* cloze: "call [evil] good" → blanks */
function clozeHTML(p, shown) {
  return esc(p.cloze)
    .replace(/\[([^\]]+)\]/g, (_, w) =>
      `<span class="blank${shown ? ' is-shown' : ''}">${w}</span>`);
}

function mcOptions(items, rightIdx, shown) {
  const letters = 'ABCD';
  return `<div class="opts">${items.map((t, i) => {
    const cls = !shown ? '' : i === rightIdx ? ' is-right' : ' is-wrong';
    return `<div class="opt${cls}"><span class="opt-letter">${letters[i]}</span><span>${esc(t)}</span></div>`;
  }).join('')}</div>`;
}

function distractors(pool, p, n, keyFn) {
  return shuffle(pool.filter(q => q.id !== p.id)).slice(0, n).map(keyFn);
}

const ROUNDS = [
  {
    id: 'doctrine-to-ref', name: 'Name the reference', icon: '📍', color: '#f0b429',
    build: p => ({
      kicker: 'Where is it written?',
      stages: [`<p class="q-main">${esc(p.doctrine)}</p>`, refCard(p)],
      pts: 1, timer: 20
    })
  },
  {
    id: 'ref-to-doctrine', name: 'What does it teach?', icon: '💡', color: '#4a9be0',
    build: p => ({
      kicker: 'What doctrine is taught here?',
      stages: [`<p class="q-ref">${esc(p.ref)}</p>`,
        `<p class="q-mid">${esc(p.doctrine)}</p><p class="q-sub">${esc(p.context)}</p>`],
      pts: 1, timer: 20
    })
  },
  {
    id: 'verse-to-ref', name: 'Read it & name it', icon: '📖', color: '#e8dcc0',
    build: p => ({
      kicker: 'Name the reference',
      stages: [`<p class="q-verse ${verseSizeClass(p)}">${verseHTML(p)}</p>`, refCard(p)],
      pts: 2, timer: 30
    })
  },
  {
    id: 'cloze', name: 'Fill in the blanks', icon: '␣', color: '#d9a3ff',
    build: p => ({
      kicker: 'Supply the missing words',
      stages: [`<p class="q-mid">${clozeHTML(p, false)}</p>`,
        `<p class="q-mid">${clozeHTML(p, true)}</p><p class="q-ref" style="font-size:4.6em">${esc(p.ref)}</p>`],
      pts: 2, timer: 30
    })
  },
  {
    id: 'progressive', name: 'One word at a time', icon: '🐢', color: '#7fd6c1',
    build: p => {
      const w = words(p.keyPhrase);
      const stages = w.map((_, i) =>
        `<p class="q-main">${w.map((word, j) =>
          j <= i ? esc(word) : `<span class="hidden-word">${esc(word)}</span>`).join(' ')}</p>`);
      stages.push(refCard(p));
      return {
        kicker: 'Buzz in as soon as you know it — fewer words, more points',
        stages,
        // Slides from 5 points down to 1 across the reveal, whatever the
        // phrase length — otherwise a long phrase stays at 5 for most of it
        // and "fewer words, more points" isn't true.
        ptsAt: st => Math.max(1, Math.ceil(5 * (1 - st / Math.max(1, w.length - 1)))),
        timer: 0
      };
    }
  },
  {
    id: 'scramble', name: 'Unscramble', icon: '🔀', color: '#ffa07a',
    build: p => {
      const w = words(p.scramble || p.keyPhrase);
      const mixed = shuffle(w);
      return {
        kicker: 'Put the phrase back together, then name the reference',
        stages: [
          `<div class="tiles">${mixed.map(x => `<span class="tile">${esc(x)}</span>`).join('')}</div>`,
          `<p class="q-mid">${esc(w.join(' '))}</p><p class="q-ref" style="font-size:4.6em">${esc(p.ref)}</p>`
        ],
        pts: 2, timer: 45
      };
    }
  },
  {
    id: 'first-letters', name: 'First letters only', icon: '🔤', color: '#9ecbff',
    build: p => {
      const w = words(p.keyPhrase);
      const initials = w.map(x => (x.match(/[A-Za-z]/) || [''])[0].toUpperCase()).join(' ');
      return {
        kicker: `${w.length} words — say the phrase`,
        stages: [`<p class="q-main q-mono">${esc(initials)}</p>`,
          `<p class="q-mid">${esc(p.keyPhrase)}</p><p class="q-ref" style="font-size:4.6em">${esc(p.ref)}</p>`],
        pts: 2, timer: 30
      };
    }
  },
  {
    id: 'listen-verse', name: 'Listen: the verse', icon: '🔊', color: '#8fd694',
    build: p => ({
      kicker: 'Eyes closed. Listen, then name the reference.',
      stages: [`<div class="speaker">🔊</div><p class="q-sub">Press <kbd>R</kbd> to hear it again</p>`,
        `<p class="q-ref">${esc(p.ref)}</p><p class="q-verse ${verseSizeClass(p)}">${verseHTML(p)}</p>`],
      speak: p.verses.map(v => v.text).join(' '), speakId: p.id,
      pts: 2, timer: 0
    })
  },
  {
    id: 'listen-doctrine', name: 'Listen: the doctrine', icon: '🎧', color: '#8fd694',
    build: p => ({
      kicker: 'Listen to the doctrine, then name the passage',
      stages: [`<div class="speaker">🎧</div><p class="q-sub">Press <kbd>R</kbd> to hear it again</p>`, refCard(p)],
      speak: p.doctrine, speakId: p.id + '-doctrine',
      pts: 1, timer: 0
    })
  },
  {
    id: 'chase', name: 'Scripture chase', icon: '🏃', color: '#ff8f6b',
    build: p => ({
      kicker: 'Scriptures out — find it and stand up!',
      stages: [`<p class="q-main">${esc(p.doctrine)}</p><p class="q-sub">Somewhere in ${esc(p.book)}…</p>`, refCard(p)],
      pts: 3, timer: 60
    })
  },
  {
    id: 'scenario', name: 'Which passage helps?', icon: '🤔', color: '#ffc857',
    build: p => ({
      kicker: 'Which Doctrinal Mastery passage speaks to this?',
      stages: [`<p class="q-mid">${esc(pick(p.scenarios))}</p>`,
        `${refCard(p)}<p class="q-sub"><b class="hi">Talk about it:</b> ${esc(p.apply)}</p>`],
      pts: 3, timer: 45
    })
  },
  {
    id: 'true-false', name: 'True or false', icon: '⚖️', color: '#7fb2ff',
    build: p => {
      const tf = pick(p.trueFalse);
      return {
        kicker: 'True, or false?',
        stages: [`<p class="q-mid">${esc(tf.s)}</p>`,
          `<p class="q-main hi">${tf.a ? 'TRUE' : 'FALSE'}</p>${refCard(p)}`],
        pts: 1, timer: 15
      };
    }
  },
  {
    id: 'which-ref', name: 'Multiple choice: reference', icon: '🅰️', color: '#c9a0ff',
    build: (p, pool) => {
      const opts = shuffle([p.ref, ...distractors(pool, p, 3, q => q.ref)]);
      const right = opts.indexOf(p.ref);
      return {
        kicker: 'Pick the reference',
        stages: [`<p class="q-mid">${esc(p.doctrine)}</p>${mcOptions(opts, right, false)}`,
          `<p class="q-mid">${esc(p.doctrine)}</p>${mcOptions(opts, right, true)}`],
        pts: 1, timer: 20
      };
    }
  },
  {
    id: 'which-doctrine', name: 'Multiple choice: doctrine', icon: '🅱️', color: '#c9a0ff',
    build: (p, pool) => {
      const opts = shuffle([p.doctrine, ...distractors(pool, p, 3, q => q.doctrine)]);
      const right = opts.indexOf(p.doctrine);
      return {
        kicker: 'What is taught in this passage?',
        stages: [`<p class="q-ref">${esc(p.ref)}</p>${mcOptions(opts, right, false)}`,
          `<p class="q-ref">${esc(p.ref)}</p>${mcOptions(opts, right, true)}`],
        pts: 1, timer: 20
      };
    }
  },
  {
    id: 'order', name: 'Put them in order', icon: '🔢', color: '#7fd6c1',
    build: (p, pool) => {
      const set = shuffle([p, ...shuffle(pool.filter(q => q.id !== p.id)).slice(0, 3)]);
      const right = set.slice().sort((a, b) => a.order - b.order);
      return {
        kicker: 'Put these in the order they appear in the Old Testament',
        stages: [
          `<div class="tiles">${set.map(q => `<span class="tile">${esc(q.ref)}</span>`).join('')}</div>`,
          `<div class="tiles">${right.map((q, i) =>
            `<span class="tile"><span class="tile-num">${i + 1}</span>${esc(q.ref)}</span>`).join('')}</div>`
        ],
        pts: 3, timer: 45
      };
    }
  },
  {
    id: 'emoji', name: 'Emoji clue', icon: '😀', color: '#ffb3d9',
    build: p => ({
      kicker: 'Name the passage from the clue',
      stages: [`<div class="q-emoji">${p.emoji}</div>`, refCard(p)],
      pts: 3, timer: 30
    })
  },
  {
    id: 'skit', name: 'Stick-figure skit', icon: '🎭', color: '#ff9ecb',
    build: p => {
      const scene = window.SKITS?.[p.id];
      if (!scene) return {                       // no scene drawn for this one yet
        kicker: 'Name the passage from the clue',
        stages: [`<div class="q-emoji">${p.emoji}</div>`, refCard(p)],
        pts: 3, timer: 30
      };
      return {
        kicker: 'What is this scene acting out?',
        stages: [
          `<div class="skit">${scene}</div>`,
          `<div class="skit skit-sm">${scene}</div>${refCard(p)}`
        ],
        pts: 3, timer: 40
      };
    }
  },
  {
    id: 'finish-it', name: 'Finish the phrase', icon: '✍️', color: '#f0b429',
    build: p => {
      const w = words(p.keyPhrase);
      const cut = Math.max(1, Math.ceil(w.length / 2));
      return {
        kicker: 'Finish it',
        stages: [`<p class="q-main">${esc(w.slice(0, cut).join(' '))} <span style="color:var(--ink-faint)">…</span></p>`,
          `<p class="q-main">${esc(w.slice(0, cut).join(' '))} <span class="hi">${esc(w.slice(cut).join(' '))}</span></p><p class="q-ref" style="font-size:4.6em">${esc(p.ref)}</p>`],
        pts: 2, timer: 20
      };
    }
  },
  {
    id: 'imposter', name: 'Spot the imposter word', icon: '🕵️', color: '#ff9e9e',
    build: p => {
      const w = words(p.keyPhrase);
      const cands = w.map((x, i) => [x, i])
        .filter(([x]) => { const k = x.toLowerCase().replace(/[^a-z]/g, ''); return NEAR_MISS[k] && !STOP.has(k); });
      if (!cands.length) {
        return {
          kicker: 'Say the phrase exactly', 
          stages: [`<p class="q-main">${esc(p.keyPhrase)}</p>`, refCard(p)],
          pts: 1, timer: 20
        };
      }
      const [orig, at] = pick(cands);
      const key = orig.toLowerCase().replace(/[^a-z]/g, '');
      const fake = NEAR_MISS[key] + orig.replace(/^[A-Za-z]+/, '');
      const shown = w.slice(); shown[at] = fake;
      const fixed = w.map((x, i) => i === at
        ? `<span class="strike">${esc(fake)}</span> <span class="hi">${esc(x)}</span>` : esc(x)).join(' ');
      return {
        kicker: 'One word is wrong. Which one — and what should it be?',
        stages: [`<p class="q-main">${esc(shown.join(' '))}</p>`,
          `<p class="q-mid">${fixed}</p><p class="q-ref" style="font-size:4.6em">${esc(p.ref)}</p>`],
        pts: 3, timer: 30
      };
    }
  },
  {
    id: 'testify', name: 'Explain, share, testify', icon: '🕊️', color: '#8fd0ff',
    build: p => ({
      kicker: 'One person, one minute — up to 3 points',
      stages: [
        `<p class="q-ref">${esc(p.ref)}</p>
         <div class="rubric">
           <div class="rubric-row"><b>Explain</b><span>What does this passage teach, in your own words?</span></div>
           <div class="rubric-row"><b>Share</b><span>${esc(p.apply)}</span></div>
           <div class="rubric-row"><b>Testify</b><span>Why do you believe it is true?</span></div>
         </div>`,
        refCard(p)
      ],
      judged: true, pts: 3, timer: 60
    })
  },
  {
    id: 'sing', name: 'Make it a song', icon: '🎵', color: '#ffd166',
    build: p => ({
      kicker: 'One minute to turn this into a tune, rap, or chant — then perform it',
      stages: [`<p class="q-mid">${esc(p.keyPhrase)}</p><p class="q-sub">Any tune you like. Bonus point if the reference is in the lyrics.</p>`,
        refCard(p)],
      judged: true, pts: 3, timer: 60
    })
  }
];


/* ═══════════════════════════════════════════════════════════
   GENERAL CONFERENCE ROUNDS

   These draw on S.gc (data/leaders.json, data/conference.json, and
   the local media/ folder) rather than the scripture passages. Each
   declares items(), the pool it picks from, and about(item), which
   names the item for the final stats. A round whose pool is empty —
   say, no recordings downloaded yet — simply drops out of the deck.
   ═══════════════════════════════════════════════════════════ */
const GC = () => S.gc || { leaders: [], talks: [], templeQuiz: null, media: { portraits: {}, clips: {} } };
const leaderById = id => GC().leaders.find(l => l.id === id);
const bare = name => String(name).replace(/^(President|Elder)\s+/, '');
/* Media comes from one of two places. On a computer that has run
   tools/fetch-media.mjs, local copies in media/ (fast, works offline).
   Anywhere else — including the GitHub Pages site — straight from
   churchofjesuschrist.org, which the repo only links to. */
const portraitSrc = id => {
  const local = GC().media.portraits[id];
  if (local) return 'media/portraits/' + local;
  return leaderById(id)?.portraitUrl || null;
};
const portrait = (id, cls = '') => portraitSrc(id)
  ? `<img class="portrait ${cls}" src="${esc(portraitSrc(id))}" alt="" referrerpolicy="no-referrer">` : '';

const EXCERPT_AT = [0.22, 0.45, 0.68];   // same points tools/fetch-media.mjs cuts at
const EXCERPT_SECONDS = 13;
function excerptsFor(t) {
  const local = GC().media.clips[t.slug];
  if (local?.length) return local.map(f => 'media/audio/' + f);
  return t.audioUrl ? EXCERPT_AT.map(at => ({ url: t.audioUrl, at })) : [];
}
const aboutLeader = l => ({ key: 'L:' + l.id, label: bare(l.name) });
const talkLine = t => `<p class="q-sub">“${esc(t.title)}” · ${esc(GC().conference || 'general conference')}</p>`;

function leaderCard(l, extra = '') {
  return `<div class="leader-card">${portrait(l.id, 'portrait-md')}
    <p class="q-ref">${esc(bare(l.name))}</p>
    <p class="q-sub">${esc(l.calling || '')}</p>${extra}</div>`;
}

/* Wrong answers: three other leaders, never the right one. */
const otherLeaders = (id, n = 3) => shuffle(GC().leaders.filter(l => l.id !== id)).slice(0, n);

/* Half the time it's multiple choice; the other half the class has to
   call the name out with no options, which is worth a point more. */
function whoIs(l, { kicker, prompt, pts, timer, answer }) {
  const mc = Math.random() < 0.5;
  const opts = mc ? shuffle([l, ...otherLeaders(l.id)]) : null;
  const names = opts && opts.map(o => bare(o.name));
  return {
    kicker: kicker + (mc ? ' — pick one' : ' — call it out, no options!'),
    stages: [
      prompt + (mc ? mcOptions(names, opts.indexOf(l), false) : ''),
      answer || leaderCard(l)
    ],
    pts: pts + (mc ? 0 : 1),
    timer
  };
}

/* "business professor" and "businessman" share a stem, so they count as
   overlapping; "airline pilot" and "lawyer" don't. */
const careerStems = c => new Set(String(c).toLowerCase().match(/[a-z]+/g)
  .filter(w => !['and', 'of', 'a', 'the', 'company'].includes(w)).map(w => w.slice(0, 5)));
const careersOverlap = (a, b) => { const s = careerStems(b); return [...careerStems(a)].some(w => s.has(w)); };

const GC_ROUNDS = [
  {
    id: 'gc-photo', kind: 'gc', name: 'Who is this?', icon: '📸', color: '#7cc4ff',
    items: () => GC().leaders.filter(l => portraitSrc(l.id)),
    about: aboutLeader,
    build: l => whoIs(l, {
      kicker: 'Name this leader',
      prompt: portrait(l.id, 'portrait-xl'),
      pts: 1, timer: 15
    })
  },
  {
    id: 'gc-voice', kind: 'gc', name: 'Whose voice?', icon: '🎙️', color: '#b9a3ff',
    items: () => GC().talks.filter(t => t.leaderId && t.kind !== 'announcement' && excerptsFor(t).length),
    about: t => aboutLeader(leaderById(t.leaderId)),
    build: t => {
      const l = leaderById(t.leaderId);
      const r = whoIs(l, {
        kicker: 'Listen — who is speaking?',
        prompt: `<div class="speaker">🎙️</div><p class="q-sub">Press <kbd>R</kbd> to hear it again</p>`,
        pts: 2, timer: 30,
        answer: leaderCard(l, talkLine(t))
      });
      r.excerpt = pick(excerptsFor(t));
      return r;
    }
  },
  {
    id: 'gc-quote', kind: 'gc', name: 'Who said it?', icon: '💬', color: '#ffb86b',
    items: () => GC().talks.filter(t => t.leaderId)
      .flatMap(t => (t.quotes || []).map(q => ({ talk: t, quote: q }))),
    about: x => aboutLeader(leaderById(x.talk.leaderId)),
    build: x => {
      const l = leaderById(x.talk.leaderId);
      return whoIs(l, {
        kicker: 'Who said this?',
        prompt: `<p class="q-mid">“${esc(x.quote)}”</p>`,
        pts: 3, timer: 30,
        answer: `<p class="q-sub q-quote">“${esc(x.quote)}”</p>${leaderCard(l, talkLine(x.talk))}`
      });
    }
  },
  {
    id: 'gc-career', kind: 'gc', name: 'Before they were apostles', icon: '💼', color: '#8fe3a8',
    items: () => GC().leaders.filter(l => l.formerCareer),
    about: aboutLeader,
    build: l => {
      const detail = l.formerCareerDetail ? `<p class="q-sub">${esc(l.formerCareerDetail)}</p>` : '';
      const others = GC().leaders.filter(o => o.id !== l.id && o.formerCareer);

      // "Lawyer and judge" and "lawyer" can't sit side by side as options, or
      // two answers are right. Careers sharing a word (by stem) never mix.
      const clean = others.filter(o => !careersOverlap(o.formerCareer, l.formerCareer));
      const unique = clean.length === others.length;

      if (unique && Math.random() < 0.5) {
        return whoIs(l, {
          kicker: 'Before full-time Church service, he was…',
          prompt: `<p class="q-main">${esc(l.formerCareer)}</p>`,
          pts: 2, timer: 20,
          answer: leaderCard(l, detail)
        });
      }
      const picks = [];
      for (const o of shuffle(clean)) {
        if (picks.length === 3) break;
        if (!picks.some(p => careersOverlap(p.formerCareer, o.formerCareer))) picks.push(o);
      }
      const opts = shuffle([l, ...picks]).map(o => o.formerCareer);
      const right = opts.indexOf(l.formerCareer);
      const who = `${portrait(l.id, 'portrait-md')}<p class="q-mid">${esc(bare(l.name))}</p>`;
      return {
        kicker: 'What was his career before full-time Church service?',
        stages: [who + mcOptions(opts, right, false), who + mcOptions(opts, right, true) + detail],
        pts: 2, timer: 20
      };
    }
  },
  {
    id: 'gc-lineup', kind: 'gc', name: 'Line up the Twelve', icon: '🔢', color: '#7fd6c1',
    maxPerGame: 2,
    items: () => GC().leaders.filter(l => l.seniority >= 4).length >= 4 ? [1, 2] : [],
    about: () => ({ key: 'lineup', label: 'Seniority of the Twelve' }),
    build: () => {
      const set = shuffle(GC().leaders.filter(l => l.seniority >= 4)).slice(0, 4);
      const right = set.slice().sort((a, b) => a.seniority - b.seniority);
      const tile = (l, n) => `<span class="tile tile-leader">${n ? `<span class="tile-num">${n}</span>` : ''}` +
        `${portrait(l.id, 'portrait-sm')}<span>${esc(bare(l.name))}</span></span>`;
      return {
        kicker: 'Put these apostles in order of seniority in the Quorum of the Twelve',
        stages: [
          `<div class="tiles">${set.map(l => tile(l)).join('')}</div>`,
          `<div class="tiles">${right.map((l, i) => tile(l, i + 1)).join('')}</div>` +
          `<p class="q-sub">Seniority comes from the order they were ordained apostles.</p>`
        ],
        pts: 3, timer: 45
      };
    }
  },
  {
    id: 'gc-temples', kind: 'gc', name: 'How many temples?', icon: '🏛️', color: '#f0d27a',
    maxPerGame: 1,
    items: () => GC().templeQuiz?.questions || [],
    about: () => ({ key: 'temples', label: 'Temple count' }),
    build: q => ({
      kicker: 'Closest guess wins — every team, write a number down!',
      stages: [
        `<p class="q-mid">${esc(q.q)}</p>`,
        `<p class="q-ref">${q.answer}</p><p class="q-sub">${esc(q.detail)}</p>` +
        `<p class="q-sub">As of ${esc(GC().templeQuiz.asOf)}, per the Church News</p>`
      ],
      pts: 3, timer: 30
    })
  }
];
ROUNDS.forEach(r => { r.kind = 'dm'; });
ROUNDS.push(...GC_ROUNDS);

const ROUND_BY_ID = Object.fromEntries(ROUNDS.map(r => [r.id, r]));

/* ═══════════════════════════════════════════════════════════
   SOUND  (generated — no audio files to ship)
   ═══════════════════════════════════════════════════════════ */
let AC = null;
const ac = () => {
  AC ||= new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
};

function tone(freq, at, dur, type = 'sine', vol = 0.22) {
  if (!S.opts.sound) return;
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + at);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.05);
}
const sfx = {
  ding:  () => { tone(880, 0, .18); tone(1320, .09, .28); },
  buzz:  () => { tone(150, 0, .3, 'sawtooth', .16); tone(110, .12, .34, 'sawtooth', .16); },
  tick:  () => tone(660, 0, .06, 'square', .07),
  swish: () => tone(520, 0, .1, 'triangle', .08),
  fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .11, .4, 'triangle', .18)); }
};

/* ═══════════════════════════════════════════════════════════
   READING ALOUD

   Three sources, best first:
     1. a recorded clip in audio/ (a real voice — yours, a
        student's, or generated by tools/make-audio.mjs)
     2. the best speech voice the browser offers
     3. whatever it has
   ═══════════════════════════════════════════════════════════ */

/* Ranked best to worst. Apple's Premium/Enhanced downloads and the Siri
   voices are far better than the compact ones macOS ships with; Chrome's
   bundled Google voices beat Apple's compact set. Safari exposes more of
   the good ones than Chrome does. */
const VOICE_RANK = [
  /\(premium\)/i,
  /\(enhanced\)/i,
  /siri/i,
  /google us english/i,
  /google uk english/i,
  /^(ava|allison|susan|zoe|evan|nathan|noelle|tom|nicky|serena|joelle)\b/i,
  /^(samantha|daniel|karen|moira|tessa|fiona)\b/i
];

function englishVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
}
const voiceScore = v => {
  const i = VOICE_RANK.findIndex(re => re.test(v.name));
  return i === -1 ? VOICE_RANK.length : i;
};
const rankedVoices = () =>
  englishVoices().sort((a, b) => voiceScore(a) - voiceScore(b) || a.name.localeCompare(b.name));

function chosenVoice() {
  const list = englishVoices();
  if (!list.length) return null;
  return list.find(v => v.name === S.opts.voice) || rankedVoices()[0] || null;
}

/* Scripture read as one long breath sounds like a machine. Break it at
   sentence and clause boundaries and queue each piece separately — the
   gap between utterances lands as a natural pause. */
function phrases(text) {
  const t = String(text)
    .replace(/[\u201c\u201d"]/g, '')            // quote marks are never spoken
    .replace(/[\u2018\u2019]/g, "'")            // keep apostrophes for contractions
    .replace(/\s*\u2026\s*/g, ', ')            // … reads as nothing, or "dot dot dot"
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')   // em/en dash becomes a breath
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const parts = t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t];
  const out = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    const last = out[out.length - 1];
    if (last && (last + ' ' + p).length <= 150) out[out.length - 1] = last + ' ' + p;
    else out.push(p);
  }
  return out;
}

const AUDIO = new Map();          // clip id → filename in audio/
let clip = null;                  // the <audio> currently playing
let lastRead = null;              // { text, id } so R can repeat it

function stopReading() {
  if (clip) { clip.pause(); clip.src = ''; clip = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function readAloud(text, id) {
  if (!S.opts.sound) return;
  stopReading();
  if (!text && !id) return;
  lastRead = { text, id };

  const file = id && AUDIO.get(id);
  if (file) {
    clip = new Audio('audio/' + file);
    clip.onended = () => { clip = null; };
    clip.play().catch(() => { clip = null; speakIt(text); });   // fall back if it won't play
    return;
  }
  speakIt(text);
}

function speakIt(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const voice = chosenVoice();
  for (const part of phrases(text)) {
    const u = new SpeechSynthesisUtterance(part);
    u.rate = S.opts.rate;
    u.pitch = 1;
    u.volume = 1;
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
    speechSynthesis.speak(u);
  }
}

/* A conference excerpt. A local file is already trimmed and just plays.
   A streamed talk is the whole recording: seek to the excerpt point once
   its length is known (the Church's server supports byte-range seeking),
   play, and stop after EXCERPT_SECONDS. */
function playExcerpt(ex) {
  if (!S.opts.sound) return;
  stopReading();
  lastRead = { excerpt: ex };
  const a = clip = new Audio(typeof ex === 'string' ? ex : ex.url);
  a.onended = () => { if (clip === a) clip = null; };
  if (typeof ex === 'string') { a.play().catch(() => {}); return; }
  a.preload = 'auto';
  a.addEventListener('loadedmetadata', () => {
    if (clip !== a) return;
    const start = a.duration * ex.at;
    a.currentTime = start;
    a.ontimeupdate = () => { if (a.currentTime >= start + EXCERPT_SECONDS) { a.pause(); a.ontimeupdate = null; } };
    a.play().catch(() => {});
  }, { once: true });
}

const repeatReading = () => {
  if (!lastRead) return;
  if (lastRead.excerpt) playExcerpt(lastRead.excerpt);
  else readAloud(lastRead.text, lastRead.id);
};

if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener('voiceschanged', () => {
    if ($('#screen-setup').classList.contains('is-active')) renderVoicePick();
  });
}

/* audio/index.json is written by tools/make-audio.mjs; absent is fine. */
fetch('audio/index.json')
  .then(r => r.ok ? r.json() : null)
  .then(m => { if (m) for (const [k, v] of Object.entries(m)) AUDIO.set(k, v); })
  .catch(() => {});

/* ═══════════════════════════════════════════════════════════
   SETUP SCREEN
   ═══════════════════════════════════════════════════════════ */
function loadPrefs() {
  try {
    const raw = localStorage.getItem('conference-showdown');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function savePrefs() {
  try {
    localStorage.setItem('conference-showdown', JSON.stringify({
      teams: S.teams.map(t => ({ name: t.name, color: t.color })),
      opts: {
        len: S.opts.len, shuffle: S.opts.shuffle, timer: S.opts.timer,
        sound: S.opts.sound, rounds: S.opts.rounds,
        voice: S.opts.voice, rate: S.opts.rate, gcShare: S.opts.gcShare,
        knownRounds: ROUNDS.map(r => r.id)
      }
    }));
  } catch { /* private browsing, never mind */ }
}

function renderTeamSetup() {
  $('#teamSetup').innerHTML = S.teams.map((t, i) => `
    <div class="team-row" style="--tc:${t.color}">
      <input type="text" value="${esc(t.name)}" placeholder="Team ${i + 1}" data-team="${i}"
             maxlength="26" aria-label="Team ${i + 1} name">
      <button class="icon-btn" data-dice="${i}" title="Random name">🎲</button>
      <div class="swatches">
        ${PALETTE.map(c => `<button class="swatch" style="--sc:${c}" data-color="${c}" data-ti="${i}"
            aria-pressed="${c === t.color}" aria-label="Colour ${c}"></button>`).join('')}
      </div>
      ${S.teams.length > 2 ? `<button class="icon-btn" data-remove="${i}" title="Remove team">✕</button>` : ''}
    </div>`).join('');
}

const VOICE_SAMPLE =
  'Surely he hath borne our griefs, and carried our sorrows: ' +
  'and with his stripes we are healed.';

function renderVoicePick() {
  const sel = $('#voicePick'), field = $('#voiceField'), note = $('#voiceNote');
  if (!sel) return;
  const list = rankedVoices();

  if (!list.length) {
    sel.innerHTML = '<option value="">System default</option>';
    field.classList.add('is-empty');
    note.textContent = 'No speech voices reported yet — the read-aloud rounds will use whatever the browser has.';
    return;
  }
  field.classList.remove('is-empty');
  const current = chosenVoice();
  sel.innerHTML = list.map(v =>
    `<option value="${esc(v.name)}"${v.name === current?.name ? ' selected' : ''}>` +
    `${esc(v.name)}${voiceScore(v) < 5 ? ' \u2605' : ''}${v.localService ? '' : ' \u00b7 online'}` +
    `</option>`).join('');

  const best = voiceScore(chosenVoice() || list[0]);
  note.textContent =
    best <= 2 ? '\u2605 marks the good voices. Press \u201cHear it\u201d to compare them.'
  : best <= 4 ? '\u2605 These sound better than the built-in voices but need internet. ' +
                'For the best quality offline, see AUDIO.md.'
  : 'These are Apple\u2019s basic compact voices. AUDIO.md explains how to get much ' +
    'better ones \u2014 it takes about five minutes.';
}

function renderRoundChips() {
  const chip = r => `
    <label class="chip">
      <input type="checkbox" value="${r.id}" ${S.opts.rounds.includes(r.id) ? 'checked' : ''}>
      <span class="chip-ico">${r.icon}</span>${esc(r.name)}
    </label>`;
  const group = (title, kind) => `
    <h3 class="chip-group">${title}</h3>
    <div class="chips">${ROUNDS.filter(r => r.kind === kind).map(chip).join('')}</div>`;
  $('#roundTypes').innerHTML =
    group(`General conference${GC().conference ? ' · ' + esc(GC().conference) : ''}`, 'gc') +
    group('Doctrinal Mastery · Old Testament', 'dm');

  // Say plainly where the photos and recordings are coming from.
  const nP = Object.keys(GC().media.portraits).length;
  const nC = Object.keys(GC().media.clips).length;
  $('#mediaNote').innerHTML = nP || nC
    ? `📸 ${nP} portrait${nP === 1 ? '' : 's'} · 🎙️ ${nC} talk recording${nC === 1 ? '' : 's'} saved on this computer.`
    : `📸 🎙️ Photos and recordings stream from churchofjesuschrist.org, so this needs an internet connection.`;
}

function initSetup() {
  const saved = loadPrefs();
  S.teams = (saved?.teams?.length >= 2 ? saved.teams : [
    { name: '', color: PALETTE[0] }, { name: '', color: PALETTE[1] }
  ]).map(t => ({ ...t, score: 0 }));
  Object.assign(S.opts, saved?.opts || {});
  if (!Array.isArray(S.opts.rounds)) S.opts.rounds = ROUNDS.map(r => r.id);
  // A round type added since these settings were saved starts switched on,
  // rather than staying hidden behind the old selection.
  const known = new Set(S.opts.knownRounds || S.opts.rounds);
  for (const r of ROUNDS) if (!known.has(r.id)) S.opts.rounds.push(r.id);
  S.opts.rounds = S.opts.rounds.filter(id => ROUND_BY_ID[id]);

  $('#setupSet').textContent = `General conference${GC().conference ? ' · ' + GC().conference : ''} · Doctrinal Mastery`;
  $('#lenOut').textContent = S.opts.len;
  $('#shareOut').textContent = Math.round(S.opts.gcShare * 100) + '%';
  $('#optShuffle').checked = S.opts.shuffle;
  $('#optTimer').checked = S.opts.timer;
  $('#optSound').checked = S.opts.sound;
  $('#rateOut').textContent = S.opts.rate.toFixed(2) + '\u00d7';
  renderTeamSetup();
  renderRoundChips();
  renderVoicePick();
  // Voices often arrive a beat after load.
  setTimeout(renderVoicePick, 300);
}

/* setup events (delegated — rows get rebuilt) */
$('#teamSetup').addEventListener('input', e => {
  const i = e.target.dataset.team;
  if (i != null) S.teams[i].name = e.target.value;
});
$('#teamSetup').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.dice != null) {
    const taken = S.teams.map(t => t.name);
    S.teams[b.dataset.dice].name = pick(NAME_IDEAS.filter(n => !taken.includes(n))) || pick(NAME_IDEAS);
    renderTeamSetup(); sfx.swish();
  } else if (b.dataset.color) {
    S.teams[b.dataset.ti].color = b.dataset.color;
    renderTeamSetup();
  } else if (b.dataset.remove != null) {
    S.teams.splice(+b.dataset.remove, 1);
    renderTeamSetup();
  }
});
$('#addTeam').onclick = () => {
  if (S.teams.length >= 4) return;
  const used = S.teams.map(t => t.color);
  S.teams.push({ name: '', color: PALETTE.find(c => !used.includes(c)) || pick(PALETTE), score: 0 });
  renderTeamSetup();
};
$$('[data-len]').forEach(b => b.onclick = () => {
  S.opts.len = Math.max(4, Math.min(40, S.opts.len + +b.dataset.len));
  $('#lenOut').textContent = S.opts.len;
});
$('#voicePick').addEventListener('change', e => {
  S.opts.voice = e.target.value;
  savePrefs();
  readAloud(VOICE_SAMPLE);
});
$('#voiceTest').onclick = () => readAloud(VOICE_SAMPLE);
$$('[data-rate]').forEach(b => b.onclick = () => {
  S.opts.rate = Math.max(0.6, Math.min(1.15, +(S.opts.rate + +b.dataset.rate).toFixed(2)));
  $('#rateOut').textContent = S.opts.rate.toFixed(2) + '\u00d7';
  savePrefs();
  readAloud(VOICE_SAMPLE);
});
$$('[data-share]').forEach(b => b.onclick = () => {
  S.opts.gcShare = Math.max(0, Math.min(1, +(S.opts.gcShare + +b.dataset.share).toFixed(1)));
  $('#shareOut').textContent = Math.round(S.opts.gcShare * 100) + '%';
});
$$('[data-rounds]').forEach(b => b.onclick = () => {
  const on = b.dataset.rounds === 'all';
  $$('#roundTypes input').forEach(i => i.checked = on);
});
['optShuffle', 'optTimer', 'optSound'].forEach(id =>
  $('#' + id).addEventListener('change', e => {
    S.opts[id.replace('opt', '').toLowerCase()] = e.target.checked;
  }));

/* Remember the setup the moment anything changes — not only when a game
   starts — so a refresh never throws away a selection. This runs after each
   control's own handler (it listens on the whole screen, so events reach it
   last), which means it always saves the updated state. */
const rememberSetup = () => {
  S.opts.rounds = $$('#roundTypes input:checked').map(i => i.value);
  savePrefs();
};
['click', 'input', 'change'].forEach(ev => $('#screen-setup').addEventListener(ev, rememberSetup));

/* ═══════════════════════════════════════════════════════════
   DECK BUILDING — the "you never know what's next" part
   ═══════════════════════════════════════════════════════════ */
function buildDeck() {
  const pool = S.data.passages;
  const enabled = $$('#roundTypes input:checked').map(i => i.value);
  S.opts.rounds = enabled.length ? enabled : ROUNDS.map(r => r.id);
  const on = S.opts.rounds.map(id => ROUND_BY_ID[id]).filter(Boolean);
  const dmRounds = on.filter(r => r.kind === 'dm');
  const gcRounds = on.filter(r => r.kind === 'gc' && r.items().length);

  const len = S.opts.len;
  let nGC = gcRounds.length ? Math.round(len * S.opts.gcShare) : 0;
  if (!dmRounds.length) nGC = gcRounds.length ? len : 0;
  const nDM = len - nGC;
  const slides = [];

  // Doctrinal Mastery: every passage shows up before any repeats, and the
  // round types cycle through a fresh shuffle each pass.
  if (nDM && dmRounds.length) {
    const order = [], types = [];
    while (order.length < nDM) order.push(...shuffle(pool));
    while (types.length < nDM) types.push(...shuffle(dmRounds));
    for (let i = 0; i < nDM; i++) slides.push({ round: types[i], item: order[i] });
  }

  // Conference: round types cycle the same way, except a round with a
  // per-game cap (one temple question, two line-ups) drops out once used.
  // Each round draws from its own shuffled queue of items.
  const used = {}, queues = {};
  const nextItem = r => {
    if (!queues[r.id]?.length) queues[r.id] = shuffle(r.items());
    return queues[r.id].shift();
  };
  const gcTypes = [];
  while (gcTypes.length < nGC) {
    const open = gcRounds.filter(r => (used[r.id] || 0) < (r.maxPerGame ?? Infinity));
    if (!open.length) break;
    for (const r of shuffle(open)) {
      if (gcTypes.length >= nGC || (used[r.id] || 0) >= (r.maxPerGame ?? Infinity)) continue;
      used[r.id] = (used[r.id] || 0) + 1;
      gcTypes.push(r);
    }
  }
  for (const r of gcTypes) slides.push({ round: r, item: nextItem(r) });

  const deck = S.opts.shuffle ? shuffle(slides) : slides;

  // No two identical round types, or the same leader, back to back.
  const about = s => s.round.kind === 'gc' ? s.round.about(s.item)
                                          : { key: 'P:' + s.item.id, label: s.item.ref };
  const clash = (x, y) => x && y && (x.round.id === y.round.id || about(x).key === about(y).key);
  for (let i = 1; i < deck.length; i++) {
    if (!clash(deck[i], deck[i - 1])) continue;
    const j = deck.findIndex((s, k) => k > i && !clash(s, deck[i - 1]) && !clash(s, deck[i + 1]) &&
                                          !clash(deck[i], deck[k - 1]) && !clash(deck[i], deck[k + 1]));
    if (j > -1) [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  S.deck = deck.map((s, i) => ({
    round: s.round,
    item: s.item,
    passage: s.round.kind === 'dm' ? s.item : null,
    ...about(s),
    built: s.round.build(s.item, pool),
    double: S.opts.shuffle && i > 0 && Math.random() < 0.12,
    awards: []
  }));
  // guarantee the last slide is a big one
  if (S.deck.length > 3) S.deck[S.deck.length - 1].double = true;
}

/* ═══════════════════════════════════════════════════════════
   PLAY
   ═══════════════════════════════════════════════════════════ */
function show(screen) {
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.id === 'screen-' + screen));
}

function startGame() {
  S.teams.forEach((t, i) => { t.name = (t.name || '').trim() || `Team ${i + 1}`; t.score = 0; });
  buildDeck();
  if (!S.deck.length) return;
  S.idx = 0; S.history = [];
  savePrefs();
  show('play');
  renderScorebar();
  renderSlide();
}

function renderScorebar() {
  const best = Math.max(...S.teams.map(t => t.score));
  $('#scorebar').innerHTML = S.teams.map((t, i) => `
    <div class="score ${t.score === best && best > 0 ? 'is-lead' : ''}" style="--tc:${t.color}" data-si="${i}">
      <span class="score-crown">${t.score === best && best > 0 ? '👑' : ''}</span>
      <span class="score-name">${esc(t.name)}</span>
      <span class="score-pts">${t.score}</span>
    </div>`).join('');
}

function currentPts() {
  const d = S.deck[S.idx], b = d.built;
  let n = b.judged ? S.judgedPts : (b.ptsAt ? b.ptsAt(S.stage) : b.pts || 1);
  return d.double ? n * 2 : n;
}

function renderSlide() {
  const d = S.deck[S.idx], b = d.built, r = d.round;
  S.stage = 0; S.slideAwards = d.awards.map(a => a.team);

  const play = $('#screen-play');
  play.style.setProperty('--gold', r.color);
  play.style.setProperty('--gold-soft', r.color);

  $('#roundBadge').textContent = `${r.icon} ${r.name}`;
  $('#progress').textContent = `${S.idx + 1} / ${S.deck.length}`;
  paintStage();
  startTimer(b.timer);
  stopReading();
  if (b.speak) setTimeout(() => readAloud(b.speak, b.speakId), 420);
  if (b.excerpt) setTimeout(() => playExcerpt(b.excerpt), 420);
  sfx.swish();
}

function paintStage() {
  const d = S.deck[S.idx], b = d.built;
  const last = S.stage >= b.stages.length - 1;
  $('#slide').innerHTML = `<div class="slide-inner">` +
    `<p class="q-kicker">${last ? 'Answer' : b.kicker}</p>` + b.stages[S.stage] + `</div>`;
  $('#roundWorth').textContent =
    (d.double ? '⭐ DOUBLE POINTS · ' : '') + `${currentPts()} ${currentPts() === 1 ? 'point' : 'points'}`;
  renderActions();
  fitSlide();
  requestAnimationFrame(fitSlide);   // re-measure once the frame has settled
}

/* Grow the type until the slide is full, shrink it if it overflows.
   Nothing is ever smaller than it has to be on a TV across the room. */
/* Candidate layout widths, in px. A wide one suits a long passage; a narrow
   one lets a three-word phrase wrap sooner and therefore scale up bigger. */
const FIT_WIDTHS = [1600, 1350, 1100, 900, 760];
const FIT_MAX = 2.6;

function fitSlide() {
  const box = $('#slide'), inner = $('.slide-inner', box);
  if (!inner) return;
  const bw = box.clientWidth, bh = box.clientHeight - 8;
  if (bw <= 0 || bh <= 0) return;

  // Try each width and keep whichever scales up the most. offsetHeight is the
  // laid-out height and ignores the transform, so this needs no reset pass.
  let best = null;
  for (const w of FIT_WIDTHS) {
    inner.style.width = w + 'px';
    const h = inner.offsetHeight;
    if (!h) continue;
    const k = Math.min(bw / w, bh / h);
    if (!best || k > best.k) best = { w, k };
  }
  if (!best) return;
  inner.style.width = best.w + 'px';
  inner.style.transform =
    `translate(-50%, -50%) scale(${Math.min(best.k * zoom, FIT_MAX).toFixed(4)})`;
}

if (document.fonts?.ready) document.fonts.ready.then(() => fitSlide());

let fitPending;
addEventListener('resize', () => {
  clearTimeout(fitPending);
  fitPending = setTimeout(() => { if ($('#screen-play').classList.contains('is-active')) fitSlide(); }, 120);
});

function renderActions() {
  const d = S.deck[S.idx], b = d.built;
  const last = S.stage >= b.stages.length - 1;
  const judged = b.judged;

  const teamBtns = S.teams.map((t, i) => `
    <button class="award" style="--tc:${t.color}" data-award="${i}" ${S.slideAwards.includes(i) ? 'disabled' : ''}>
      <kbd>${i + 1}</kbd> ${esc(t.name)} <span class="award-pts">+${currentPts()}</span>
    </button>`).join('');

  const ptsPick = judged ? `
    <div class="pts-pick"><span>Award</span>
      ${[1, 2, 3].map(n => `<button class="pts-btn" data-jp="${n}" aria-pressed="${S.judgedPts === n}">${n}</button>`).join('')}
    </div>` : '';

  $('#actions').innerHTML = `
    ${ptsPick}${teamBtns}
    ${S.teams.length > 1 ? `<button class="btn btn-sm" data-award="both"><kbd>B</kbd> Both</button>` : ''}
    <button class="btn btn-sm" data-award="none"><kbd>0</kbd> Nobody</button>
    <button class="btn btn-primary" id="mainBtn">${last ? (S.idx === S.deck.length - 1 ? 'Final scores →' : 'Next →') : 'Reveal'}</button>`;
}

/* ── awarding ───────────────────────────────────────────── */
function award(which) {
  const d = S.deck[S.idx];
  const pts = currentPts();

  if (which === 'none') {
    d.missed = true;
    sfx.buzz();
  } else {
    const list = which === 'both'
      ? S.teams.map((_, i) => i).filter(i => !S.slideAwards.includes(i))
      : [+which];
    list.forEach(i => {
      if (S.slideAwards.includes(i)) return;
      S.teams[i].score += pts;
      S.slideAwards.push(i);
      d.awards.push({ team: i, pts });
      d.missed = false;
    });
    if (!list.length) return;
    sfx.ding();
    renderScorebar();
    list.forEach(i => {
      const el = $(`.score[data-si="${i}"]`);
      if (el) { el.classList.add('just-scored'); setTimeout(() => el.classList.remove('just-scored'), 600); }
    });
  }
  // everyone sees the answer once points are settled
  S.stage = d.built.stages.length - 1;
  stopTimer();
  paintStage();
}

/* ── navigation ─────────────────────────────────────────── */
function advance() {
  const b = S.deck[S.idx].built;
  if (S.stage < b.stages.length - 1) {
    S.stage++;
    if (S.stage === b.stages.length - 1) stopTimer();
    paintStage();
  } else {
    next();
  }
}
function next() {
  const d = S.deck[S.idx];
  S.history.push({
    i: S.idx, roundId: d.round.id, key: d.key, label: d.label,
    awards: d.awards.slice(), missed: !d.awards.length
  });
  if (S.idx >= S.deck.length - 1) return finish();
  S.idx++; renderSlide();
}
function back() {
  if (S.idx === 0) { S.stage = 0; paintStage(); return; }
  // undo the slide we are returning to so it can be re-scored
  S.idx--;
  const d = S.deck[S.idx];
  d.awards.forEach(a => S.teams[a.team].score -= a.pts);
  d.awards = []; d.missed = false;
  S.history = S.history.filter(h => h.i !== S.idx);
  renderScorebar();
  renderSlide();
}
function skip() {
  if (S.idx >= S.deck.length - 1) return endEarly();
  S.idx++; renderSlide();
}

/* ── timer ──────────────────────────────────────────────── */
const ARC = 2 * Math.PI * 17;
function startTimer(secs) {
  stopTimer();
  const box = $('#timer');
  if (!secs || !S.opts.timer) { box.hidden = true; return; }
  box.hidden = false;
  S.timer = { id: null, left: secs, total: secs };
  paintTimer();
  S.timer.id = setInterval(() => {
    S.timer.left--;
    paintTimer();
    if (S.timer.left <= 5 && S.timer.left > 0) sfx.tick();
    if (S.timer.left <= 0) { stopTimer(); sfx.buzz(); }
  }, 1000);
}
function paintTimer() {
  const { left, total } = S.timer;
  $('#timerNum').textContent = Math.max(0, left);
  $('#timerArc').style.strokeDashoffset = String(ARC * (1 - Math.max(0, left) / total));
  $('#timer').classList.toggle('is-low', left <= 5);
}
function stopTimer() { if (S.timer.id) clearInterval(S.timer.id); S.timer.id = null; }
function toggleTimer() {
  const b = S.deck[S.idx].built;
  if (S.timer.id) { stopTimer(); }
  else if (b.timer) startTimer(b.timer);
}

/* ═══════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════ */
function endEarly() {
  const d = S.deck[S.idx];
  if (d && !S.history.some(h => h.i === S.idx)) {
    S.history.push({
      i: S.idx, roundId: d.round.id, key: d.key, label: d.label,
      awards: d.awards.slice(), missed: !d.awards.length
    });
  }
  finish();
}

function finish() {
  stopTimer(); stopReading();
  const max = Math.max(...S.teams.map(t => t.score), 1);
  const best = Math.max(...S.teams.map(t => t.score));
  const winners = S.teams.filter(t => t.score === best);

  // per-passage tally across the game
  const tally = {}, labels = {};
  S.history.forEach(h => {
    const t = tally[h.key] ||= { hit: 0, miss: 0 };
    labels[h.key] = h.label;
    h.missed ? t.miss++ : t.hit++;
  });
  const seen = prefix => Object.keys(tally).filter(k => k.startsWith(prefix)).length;
  const CAP = 6;
  const clip = list => ({ rows: list.slice(0, CAP), more: Math.max(0, list.length - CAP) });
  const tough = clip(Object.entries(tally).filter(([, t]) => t.miss > 0)
    .sort((a, b) => b[1].miss - a[1].miss));
  const solid = clip(Object.entries(tally).filter(([, t]) => t.miss === 0 && t.hit > 0)
    .sort((a, b) => b[1].hit - a[1].hit));

  const roundPts = {};
  S.deck.forEach(d => {
    const sum = d.awards.reduce((n, a) => n + a.pts, 0);
    if (!sum) return;
    roundPts[d.round.name] = (roundPts[d.round.name] || 0) + sum;
  });
  const topRounds = Object.entries(roundPts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const totalAwarded = S.history.reduce((n, h) => n + h.awards.reduce((m, a) => m + a.pts, 0), 0);
  const answered = S.history.filter(h => !h.missed).length;

  $('#statsWrap').innerHTML = `
    <h2 class="stats-title">Final scores</h2>
    <p class="winner">${winners.length > 1
      ? `It's a tie! ${winners.map(w => esc(w.name)).join(' &amp; ')}`
      : `🏆 ${esc(winners[0].name)} wins`}</p>

    <div class="bars">
      ${S.teams.slice().sort((a, b) => b.score - a.score).map(t => `
        <div class="bar-row" style="--tc:${t.color}">
          <span class="bar-name">${esc(t.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Math.round(t.score / max * 100)}%"></span></span>
          <span class="bar-pts">${t.score}</span>
        </div>`).join('')}
    </div>

    <div class="stats-cols">
      <div class="stats-panel">
        <h3>📚 Study these next</h3>
        ${tough.rows.length ? `<ul class="stats-list">${tough.rows.map(([id, t]) => `
          <li><span>${esc(labels[id])}</span><span class="muted tag-miss">stumped us ${t.miss}×</span></li>`).join('')
        }${tough.more ? `<li><span class="muted">+${tough.more} more</span><span></span></li>` : ''}</ul>`
      : `<p class="stats-empty">Nothing stumped them — everything got answered. 🎉</p>`}
      </div>

      <div class="stats-panel">
        <h3>✅ Nailed it every time</h3>
        ${solid.rows.length ? `<ul class="stats-list">${solid.rows.map(([id, t]) => `
          <li><span>${esc(labels[id])}</span><span class="muted tag-hit">${t.hit}/${t.hit}</span></li>`).join('')
        }${solid.more ? `<li><span class="muted">+${solid.more} more</span><span></span></li>` : ''}</ul>`
      : `<p class="stats-empty">—</p>`}
      </div>

      <div class="stats-panel">
        <h3>🎯 Best round types</h3>
        ${topRounds.length ? `<ul class="stats-list">${topRounds.map(([n, v]) => `
          <li><span>${esc(n)}</span><span class="muted">${v} pts</span></li>`).join('')}</ul>`
      : `<p class="stats-empty">—</p>`}
      </div>

      <div class="stats-panel">
        <h3>📈 The game</h3>
        <ul class="stats-list">
          <li><span>Rounds played</span><span class="muted">${S.history.length}</span></li>
          <li><span>Rounds answered</span><span class="muted">${answered} of ${S.history.length}</span></li>
          <li><span>Points awarded</span><span class="muted">${totalAwarded}</span></li>
          <li><span>Leaders covered</span><span class="muted">${seen('L:')} of ${GC().leaders.length}</span></li>
          <li><span>Passages seen</span><span class="muted">${seen('P:')} of ${S.data.passages.length}</span></li>
        </ul>
      </div>
    </div>

    <div class="stats-actions">
      <button class="btn btn-primary btn-xl" id="againBtn">Play again</button>
      <button class="btn" id="setupBtn">Change teams</button>
    </div>`;

  show('stats');
  sfx.fanfare();
  // start the bar animation only once the screen actually has a box
  requestAnimationFrame(() => $('.bars')?.classList.add('is-live'));
  $('#againBtn').onclick = () => startGame();
  $('#setupBtn').onclick = () => { show('setup'); renderTeamSetup(); };
}

/* ═══════════════════════════════════════════════════════════
   CHROME — fullscreen, zoom, keys
   ═══════════════════════════════════════════════════════════ */
function toggleFS() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
let zoom = 1;
function setZoom(d) {
  zoom = Math.max(0.7, Math.min(1.6, zoom + d));
  document.documentElement.style.setProperty('--zoom', zoom.toFixed(2));
  if ($('#screen-play').classList.contains('is-active')) fitSlide();
}

$('#startBtn').onclick = startGame;
$('#fsBtnSetup').onclick = toggleFS;
$('#fsBtnPlay').onclick = toggleFS;
$('#skipBtn').onclick = skip;
$('#quitBtn').onclick = endEarly;
$('#helpBtn').onclick = () => $('#helpOverlay').hidden = false;
$('#helpClose').onclick = () => $('#helpOverlay').hidden = true;
$('#helpOverlay').onclick = e => { if (e.target.id === 'helpOverlay') $('#helpOverlay').hidden = true; };

$('#actions').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  b.blur();
  if (b.id === 'mainBtn') return advance();
  if (b.dataset.jp) { S.judgedPts = +b.dataset.jp; return paintStage(); }
  if (b.dataset.award != null) return award(b.dataset.award);
});

document.addEventListener('keydown', e => {
  if (e.target?.matches?.('input[type=text]')) return;

  if (e.key === 'Escape') { $('#helpOverlay').hidden = true; return; }
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { $('#helpOverlay').hidden = !$('#helpOverlay').hidden; e.preventDefault(); return; }
  if (e.key === 'f' || e.key === 'F') { toggleFS(); return; }
  if (e.key === '+' || e.key === '=') { setZoom(.06); return; }
  if (e.key === '-' || e.key === '_') { setZoom(-.06); return; }

  const playing = $('#screen-play').classList.contains('is-active');
  if (!playing) {
    if (e.key === 'Enter' && $('#screen-setup').classList.contains('is-active')) startGame();
    return;
  }
  if (!$('#helpOverlay').hidden) return;

  switch (e.key) {
    case ' ': case 'Enter': case 'ArrowRight': case 'PageDown':
      e.preventDefault(); advance(); break;
    case 'ArrowLeft': case 'PageUp':
      e.preventDefault(); back(); break;
    case '0':
      award('none'); break;
    case 'b': case 'B':
      award('both'); break;
    case 'r': case 'R':
      repeatReading(); break;
    case 't': case 'T':
      toggleTimer(); break;
    case 's': case 'S':
      skip(); break;
    default:
      if (/^[1-4]$/.test(e.key) && +e.key <= S.teams.length) award(+e.key - 1);
  }
});

/* ── boot ───────────────────────────────────────────────── */
/* ?preview=all&slide=N — one slide per round type, for eyeballing layouts */
function maybePreview() {
  const q = new URLSearchParams(location.search);
  if (!q.has('preview')) return false;
  const only = q.get('preview');
  const list = only === 'all' ? ROUNDS : ROUNDS.filter(r => r.id === only);
  if (!list.length) return false;
  S.teams = [
    { name: 'The Watchmen', color: PALETTE[0], score: 7 },
    { name: 'Stonecutters', color: PALETTE[1], score: 4 }
  ];
  const pool = S.data.passages;
  S.deck = list.map((rt, i) => {
    const item = rt.kind === 'gc' ? (rt.items()[i % Math.max(1, rt.items().length)] ?? null)
                                  : pool[i % pool.length];
    if (item == null) return null;
    return { item, passage: rt.kind === 'dm' ? item : null, round: rt,
             built: rt.build(item, pool), double: i === 2, awards: [] };
  }).filter(Boolean);
  if (!S.deck.length) return false;
  S.idx = Math.min(S.deck.length - 1, Math.max(0, +(q.get('slide') || 0)));
  S.history = [];
  S.opts.sound = false;
  show('play'); renderScorebar(); renderSlide();
  const st = q.get('stage');
  if (st != null) {
    const n = S.deck[S.idx].built.stages.length;
    S.stage = st === 'last' ? n - 1 : Math.min(n - 1, Math.max(0, +st || 0));
    paintStage();
  }
  return true;
}

const getJSON = (url, fallback) => fetch(url).then(r => r.ok ? r.json() : fallback).catch(() => fallback);

/* data/ is committed; media/ is downloaded locally by tools/fetch-media.mjs
   and never committed, so it may be missing — the photo and voice rounds
   then just drop out. */
async function loadConference() {
  const [lead, conf, media] = await Promise.all([
    getJSON('data/leaders.json', { leaders: [] }),
    getJSON('data/conference.json', { talks: [] }),
    getJSON('media/index.json', { portraits: {}, clips: {} })
  ]);
  const leaders = (lead.leaders || []).slice().sort((a, b) => a.seniority - b.seniority);
  const byName = Object.fromEntries(leaders.map(l => [bare(l.name), l.id]));
  const talks = (conf.talks || []).map(t => ({ ...t, leaderId: t.leaderId || byName[bare(t.speaker)] || null }));
  return {
    conference: conf.conference || '',
    leaders, talks,
    templeQuiz: conf.templeQuiz || null,
    media: { portraits: media.portraits || {}, clips: media.clips || {} }
  };
}

Promise.all([fetch('data/passages.json').then(r => r.json()), loadConference()])
  .then(([d, gc]) => { S.data = d; S.gc = gc; initSetup(); maybePreview(); })
  .catch(() => {
    $('#screen-setup').innerHTML =
      `<div class="setup-wrap"><h1 class="title">Couldn't load the game data</h1>
       <p class="q-sub">Open this page through a web server (or GitHub Pages) rather than
       double-clicking the file — browsers block local file reads.</p></div>`;
  });

