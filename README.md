# Doctrinal Mastery Showdown

A big-screen, two-team review game for the 24 Doctrinal Mastery passages. Built to be
projected on a classroom TV and driven with a presentation clicker from across the room.

Currently loaded: **Old Testament, 2nd half** — the 12 passages from Isaiah 5 through Malachi 4.

## Running it

It's a plain static site. Open `index.html` through any web server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

(Double-clicking the file won't work — browsers block the local `fetch` of `data/passages.json`.)

## Playing

1. **Name the teams** on the start screen. Pick a colour, or hit 🎲 for a random name.
2. Choose how many rounds, and which round types are in the mix.
3. **Start the game**, then hit `F` for full screen.

Every slide is a surprise: the round type *and* the passage are shuffled, so nobody can
guess what's coming. Roughly one slide in eight is worth **double points**, and the last
slide always is.

You are the judge. Reveal the answer when the teams have had their shot, then click the
team that got it. The scoreboard stays on screen the whole game, and the final screen
shows who won plus which passages need more work.

### Keys (a presentation clicker sends PgDn / PgUp, so it drives everything)

| Key | What it does |
| --- | --- |
| `Space` `→` `PgDn` | Reveal the answer, then move to the next slide |
| `1` … `4` | Award the round to that team |
| `B` | Award both teams |
| `0` | Nobody got it — reveals the answer |
| `←` `PgUp` | Back a slide (clears its points so you can re-score it) |
| `R` | Read it aloud again |
| `T` | Start / stop the timer |
| `+` `−` | Bigger / smaller text |
| `F` | Full screen |
| `?` | Show all the keys |

## The round types

Twenty ways to ask about the same passage, so the same 12 verses stay interesting:

| | Round | What the class does |
| --- | --- | --- |
| 📍 | Name the reference | Sees the doctrine, names the reference |
| 💡 | What does it teach? | Sees the reference, states the doctrine |
| 📖 | Read it & name it | Sees the full verse, names the reference |
| ␣ | Fill in the blanks | Supplies the missing key words |
| 🐢 | One word at a time | Words appear one by one — fewer words, more points |
| 🔀 | Unscramble | Puts a scrambled phrase back together |
| 🔤 | First letters only | Reads `S H B O G` back as the phrase |
| 🔊 | Listen: the verse | Eyes closed, the verse is read aloud |
| 🎧 | Listen: the doctrine | Same, but the doctrine phrase |
| 🏃 | Scripture chase | Scriptures out, first team to find it stands |
| 🤔 | Which passage helps? | A real-life situation — which passage speaks to it? |
| ⚖️ | True or false | Judges a statement about the passage |
| 🅰️ | Multiple choice: reference | Four references, one right |
| 🅱️ | Multiple choice: doctrine | Four doctrines, one right |
| 🔢 | Put them in order | Four references into Old Testament order |
| 😀 | Emoji clue | Names the passage from an emoji rebus |
| ✍️ | Finish the phrase | Completes the second half |
| 🕵️ | Spot the imposter word | One word has been swapped — find it and fix it |
| 🕊️ | Explain, share, testify | One student, one minute, up to 3 points |
| 🎵 | Make it a song | One minute to turn the phrase into a tune, then perform it |

The last two are judged — pick 1, 2, or 3 points in the action bar before awarding.

`?preview=all` walks one slide per round type if you want to see them before class.
`?preview=<round-id>` shows just one.

## The read-aloud rounds

Pick the **Reading voice** on the start screen and press **Hear it** to compare — ★ marks
the better ones. The stock Mac voices sound robotic; **[AUDIO.md](AUDIO.md)** covers the
three ways to fix that, including recording a real voice (yours or a student's) into
`audio/`, which the game will play instead.

## Adding or changing passages

Everything the game asks comes out of `data/passages.json`. Each entry:

```json
{
  "id": "isa-5-20",
  "ref": "Isaiah 5:20",
  "book": "Isaiah",
  "order": 1,
  "doctrine": "Woe unto them that call evil good, and good evil.",
  "keyPhrase": "Woe unto them that call evil good, and good evil",
  "cloze": "Woe unto them that call [evil] good, and [good] [evil]",
  "scramble": "call evil good and good evil",
  "emoji": "😈👍 · 😇👎 · 🌑💡",
  "context": "One line of who, when, and what — shown with the answer.",
  "scenarios": ["A real-life situation this passage answers."],
  "trueFalse": [{ "s": "A statement about the passage.", "a": true }],
  "apply": "A question that pushes toward doing something about it.",
  "verses": [{ "v": 20, "text": "Woe unto them that call evil good…" }]
}
```

Notes that matter:

- `order` is canonical scripture order (1, 2, 3…). The "Put them in order" round uses it.
- `cloze` marks blanked words in `[square brackets]`. Two to four per passage works well.
- `keyPhrase` should be the short, memorable line — it feeds the reveal, scramble,
  first-letters, finish-the-phrase, imposter, and song rounds. Keep it under ~12 words.
- `scramble` is a 4–6 word slice; a longer phrase turns into chaos on screen.
- Give every passage at least one `scenarios` entry and one `trueFalse` pair, or those
  rounds will keep reusing the same one.
- Verse text is KJV. Keep the spelling as printed ("marvellous", "honour").

Adding the first-half Old Testament passages, or next year's set, means adding entries
here — no code changes.

## Layout

- `index.html` — the three screens: setup, play, final scores
- `styles.css` — everything scales off `--u` (1vmin), so it fills any screen
- `app.js` — round definitions, deck building, scoring, stats
- `data/passages.json` — the passages
- `audio/` — optional recorded clips for the listening rounds (see AUDIO.md)
- `tools/make-audio.mjs` — records those clips, or re-indexes ones you added

Slide type auto-sizes: each slide is laid out at a fixed width and then scaled to fill the
screen, so the longest passage and a three-word phrase both fill a 65" TV — and nothing
gets cut off in full screen, whatever the display's shape.
