# Working on Conference Showdown

A fork of Doctrinal Mastery Showdown that adds general conference rounds. The original repo is
untouched; changes here don't go back to it.

## Conference data — accuracy first

Misattributing a quote, or naming the wrong man as an apostle, in front of a seminary class is the
worst way this can fail. So:

- **Never fill conference facts from memory.** Leadership changes (President Nelson died September
  2025, Elder Holland December 2025; Elders Caussé and Gilbert were called after). Verify against
  churchofjesuschrist.org leader bios and the Church News, and note an as-of date.
- **Quotes are verbatim.** Fetch talk pages with curl and extract text with code — never via a
  summarising fetch tool, which paraphrases. After editing, re-check every quote is a substring of
  the published talk text (footnote `<sup>` markers stripped).
- **A quote must not give the speaker away** — no names of his wife or family, his hometown, his
  former job, or procedural lines only the presiding officer would say ("we will sustain…").
- **Career options must not overlap.** `careersOverlap()` blocks distractors that share a word stem
  with the answer ("lawyer" vs "lawyer and judge"); a career shared with anyone else never gets the
  "which leader had this career?" form.

## Fairness rules for the leader rounds

Every one of these has a way to produce a question with two right answers. The guards:

- **Two truths and a lie.** The lie is always another leader's *real* fact of the same kind, never
  invented. It's rejected if it could be true of this man: same birth city; a career sharing a
  word stem (`careersOverlap`); a fun fact touching the same place or its language
  (`PLACE_GROUPS`: "speaks French" vs. born in France); a mission fact when this man's own mission
  isn't on record; or a fact flagged `funFactCanBeLie: false` in leaders.json (Elder Gong's
  "served as a seminary teacher" could be true of others).
- **Odd one out.** Groupings are plain biographical facts only. Never split by calling (First
  Presidency vs. Twelve): all fifteen are apostles, and President Eyring is also President of the
  Quorum of the Twelve, so any such explanation is false. `oddSet()` rejects any four where another grouping in `ODD_GROUPS` singles out a
  different man. Add a grouping and every set is re-checked against it automatically.
- **Where in the world?** Only leaders whose `birthCity` no other leader shares (Logan, Salt Lake
  City, and Oakland each have two). The map is `data/world-land.json`, built once by
  `tools/make-map.mjs` from Natural Earth (public domain); the zoom is a CSS transform, not SMIL.

## How conference rounds plug in

Rounds in `GC_ROUNDS` have `kind: 'gc'`, plus `items()` (the pool to draw from) and `about(item)`
(`{ key, label }` for the end-of-game stats). `build` may return `null` when it can't make a fair slide; the deck drops it. Doctrinal Mastery rounds are `kind: 'dm'` and draw
from the passages. `buildDeck()` splits the game by `S.opts.gcShare`, caps rounds with
`maxPerGame`, and keeps the same round type or the same leader from appearing twice in a row.

A round whose `items()` is empty drops out silently — that's how the photo and voice rounds
behave when `media/` hasn't been downloaded.

## Media

Two sources, chosen per item: local copies in `media/` when present, otherwise streamed from
churchofjesuschrist.org using the `portraitUrl` / `audioUrl` in the data files. The public
GitHub Pages site always streams. A streamed talk is the whole recording; `playExcerpt()` seeks to
the excerpt point after `loadedmetadata` and stops 13 seconds later — the Church's server supports
byte ranges, which seeking needs.

`media/` is gitignored and must stay that way (Church-copyrighted portraits and audio).
`tools/fetch-media.mjs` downloads portraits and cuts three 13-second excerpts per talk with HTTP
Range requests — it reads the MP3 header for the bitrate and trims to a frame boundary, so no
ffmpeg and no whole-talk downloads. Excerpts play from the start in a plain `<audio>`; nothing
seeks, so the stock Python server (no Range support) is fine.

The listening rounds show a canvas waveform driven by `data/envelopes.json`: each excerpt's
loudness, 20 values a second, measured by `fetch-media.mjs` with macOS `afconvert` and committed
(numbers only, no audio). It's played back against `clip.currentTime`, so it follows the real
speech both locally and when streamed. **Do not switch it to a Web Audio analyser.** The Church's
server sends no CORS headers, so an analyser can't read streamed audio; and routing local playback
through an AudioContext stalled it at 0:00 in a real-Chrome test, a silent clip in class. Keep
playback a plain `<audio>` element.

Testing audio needs real, headed Chrome. Headless Chrome never advances media time, and in
`--headless=new` timers and `fetch` don't run either. Launch headed Chrome with a throwaway
`--user-data-dir`, mute the clip, and have the page report results by requesting a URL the local
server logs.

Portrait `<img>`s have fixed CSS sizes. An image that sized itself on load would change the
slide's height after `fitSlide()` measured it.

---

# Working on this game

A static, dependency-free site. No build step, no package.json.

## Adding a round type

Round types live in the `ROUNDS` array in `app.js`. Each one is:

```js
{
  id: 'kebab-id', name: 'Shown on the badge', icon: '📍', color: '#f0b429',
  build: (p, pool) => ({
    kicker: 'The instruction the class reads',
    stages: [promptHTML, answerHTML],   // last stage is always the answer
    pts: 2,                             // or ptsAt: stage => n for a sliding value
    timer: 30,                          // seconds, or 0 for none
    judged: false,                      // true shows a 1/2/3 point picker
    speak: 'text read aloud when the slide opens'
  })
}
```

`color` tints the whole play screen for that round — that visual shift is how the class
notices the game changed shape, so give a new round a colour that isn't already in use.

Rules for `build`:

- It gets one passage and the whole `pool`, so a round can pull distractors or build a set.
- Every stage must be a non-empty HTML string. Escape anything from the data with `esc()`.
- Use the existing slide classes (`q-main`, `q-mid`, `q-verse`, `q-ref`, `q-sub`, `tiles`,
  `opts`, `rubric`) rather than new ones — they are all `em`s of one base size, which is
  what lets `fitSlide()` scale a slide to fill the screen.
- A new round type is opt-in on the setup screen automatically.

## Slide sizing

A slide is laid out at a **fixed virtual width** with **fixed 16px-based font sizes**, then
scaled to fill the window with a CSS transform — the way a slide deck does it. `fitSlide()`
tries each width in `FIT_WIDTHS`, keeps whichever yields the largest scale, and applies
`translate(-50%,-50%) scale(k)`. A wide virtual width suits a long passage; a narrow one
lets a short phrase wrap sooner and therefore scale up bigger.

Rules that follow from that:

- Size slide content in `em` (of the 16px base) or `%` of the virtual width. Never `vmin`,
  `vw`, or `vh` — the scale, not the viewport, decides how big it ends up.
- Never animate `transform` on `.slide-inner`; `fitSlide()` owns that property. The entry
  animation is opacity-only for this reason.
- Measure with `offsetHeight`, which is the laid-out height and ignores the transform.

An earlier version scaled by mutating `font-size` and re-measuring in a loop. Don't go
back to that: changing a font-size (or a custom property feeding one) and synchronously
reading a descendant's geometry does not reliably reflect the new `em` cascade, so the
loop measured roughly half the true height and let four-option slides overflow. The
fixed-layout-plus-transform approach measures once per candidate width and can't drift.
`text-wrap: pretty` caused a related mismatch by re-wrapping after layout — leave it off.

## Stick-figure skits

`skits.js` holds one looping SVG scene per passage, keyed by passage id, composed from
helpers at the top of the file (`fig`, `at`, `heart`, `book`, `cloud`, `beam`, `rays`,
`temple`, `sack`, …) rather than drawn from scratch. Animation classes and keyframes live
in styles.css under the skit heading; scenes compose those rather than defining their own.

Four rules, all of which broke something first:

- **Positioning and animation never share an element.** A CSS `transform` overrides an
  SVG `transform` attribute, so `at(x, y, …)` wraps a `<g>` for placement and the
  animation class goes on a `<g>` inside it.
- **Every animation is a 6s loop**, so beats across a scene stay in step. Timing lives in
  the keyframe percentages; `--d` shifts one element's phase (used for staggering).
- **Keep everything inside the 400×220 viewBox at every moment of the loop, including
  what moves.** `rays(n, r1, r2)` drawn at height `y` reaches `y - r2`, which is what
  clipped the light off four scenes. Translations count too — check the extremes.
- **Fill the frame.** A scene using only the middle of the viewBox renders small on a TV,
  because the empty margin scales up with it. Aim for ink spanning x 40–360.

Review changes with `tools/skit-sheet.html`, which renders all twelve at once.
`?t=2500` pauses every scene at that moment in the loop — it sets `currentTime` on each
animation, so per-element delays stay intact and one beat can be judged at a time. Check
a few moments; a scene can read perfectly at one and be empty at another.

Reverence, not a style choice: **the Saviour and Deity are never drawn as stick figures.**
Isaiah 53 is staged as a burden lifted away, and where the Lord speaks it is light from
above. Temples get a spire and finial — an earlier version drew a cross, which is wrong
iconography here.

## Reading aloud

`readAloud(text, id)` tries a recorded clip from `audio/` first (looked up in the
`audio/index.json` manifest fetched at boot), and falls back to speech synthesis. A round
opts in by returning `speak` (the text) and ideally `speakId` (the clip id) from `build`.

Don't call `speechSynthesis.speak()` directly — go through `readAloud`, so recorded clips,
the chosen voice, the reading speed, and `stopReading()` on slide change all keep working.
`phrases()` splits text at sentence and clause boundaries and strips the characters
synthesisers mishandle; it is pure, so it can be unit-tested straight out of app.js.

Voice choice is a ranked preference (`VOICE_RANK`), not the browser's default, which is
usually the worst available. Never pick by list order — Apple's compact voices come first
in Chrome and sound the worst.

## Checking a layout change

Beyond eyeballing it, assert it: temporarily loop every round type × passage × stage,
call `fitSlide()`, and compare `.slide-inner`'s transformed `getBoundingClientRect()`
against `#slide`'s. It should never exceed it. Run that at 1280x720, 1440x900, 1920x1080,
and 2560x1440 — 580 slides per size, and all four must come back clean.

## Checking a change

There is no test runner. Render it — a syntax check won't catch a layout bug:

```sh
python3 -m http.server 8765 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --hide-scrollbars --virtual-time-budget=3000 --window-size=1920,1080 \
  --screenshot=/tmp/shot.png "http://localhost:8765/?preview=all&slide=2"
```

`?preview=all&slide=N` shows one slide per round type; add `&stage=last` for the answer.
Slide 2 (Isaiah 53:3–5, the longest passage) and any `tiles`/`opts` round are the two
cases worth checking after a styling change.
