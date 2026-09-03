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

Do **not** put absolute font sizes on slide content. `.slide-inner` carries one base
`font-size` and `fitSlide()` binary-searches it between 0.45× and 2.6× until the slide
fills the screen without overflowing. Anything inside a slide must be sized in `em`.

Two things that broke this before, so don't reintroduce them:

- `text-wrap: pretty` re-wraps after layout, so measurements disagree with what paints.
- Measuring before the action bar renders overstates the available room. `fitSlide()`
  runs last in `paintStage()` for that reason.

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
