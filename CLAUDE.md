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
