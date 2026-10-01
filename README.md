# Conference Showdown

A big-screen, two-team review game mixing **general conference** with **Doctrinal Mastery**.
Forked from Doctrinal Mastery Showdown, which carries on unchanged.

Loaded with: the **April 2026** general conference (First Presidency and Quorum of the Twelve),
leadership current as of September 30, 2026, and the 12 Old Testament (2nd half) Doctrinal
Mastery passages. By default 70% of each game is conference; change it on the start screen.

## Running it

**First time on a computer**, download the photos and talk recordings (about 11 MB, a few seconds):

```sh
node tools/fetch-media.mjs
```

Then **double-click `Play Conference Showdown.command`** — it starts a local server and opens
the game. Keep its window open while you play.

The photos and recordings land in `media/`, which is deliberately never committed: they're the
Church's copyrighted files, fine for class but not ours to republish. Without them the game still
runs — "Who is this?" and "Whose voice?" just drop out, and the start screen says so.

## Conference rounds

| | Round | What the class does | Points |
| --- | --- | --- | --- |
| 📸 | Who is this? | Names a leader from his official portrait | 1 |
| 🎙️ | Whose voice? | Hears 13 seconds of a talk (`R` replays) and names the speaker | 2 |
| 💬 | Who said it? | Names the speaker of a verbatim quote | 3 |
| 💼 | Before they were apostles | Matches a leader to his career before full-time service | 2 |
| 🔢 | Line up the Twelve | Puts four apostles in seniority order | 3 |
| 🏛️ | How many temples? | Closest guess to the Church's temple count wins | 3 |

The first three randomly come as **multiple choice** or **call it out** (no options, +1 point).

### Where the content comes from

Everything is sourced from churchofjesuschrist.org and the Church News, never from memory:

- `data/leaders.json` — names, callings, seniority, careers from each leader's official bio,
  portrait URLs. Seniority follows the Quorum's official order.
- `data/conference.json` — every April 2026 talk by the First Presidency and the Twelve: title,
  link, audio URL, and quotes copied character-for-character from the talk (all 48 re-checked
  against the published text).
- Temple counts are as of August 1, 2026, and the slide says so.

No temples were announced at April 2026 conference: since October 2025 the Church announces them
locally. That's why the temple round asks about the total count instead.

### After a conference

To switch to a new conference, update `data/conference.json` (and `data/leaders.json` if anyone
was called or released), re-check every quote against the published talk, then run
`node tools/fetch-media.mjs`. CLAUDE.md has the rules for choosing quotes.

## Doctrinal Mastery

### The round types

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
| 🎭 | Stick-figure skit | Watches a little animated scene act the passage out |
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
- `skits.js` — the twelve animated stick-figure scenes
- `tools/skit-sheet.html` — all twelve side by side, for reviewing them
- `audio/` — optional recorded clips for the listening rounds (see AUDIO.md)
- `tools/make-audio.mjs` — records those clips, or re-indexes ones you added

Slide type auto-sizes: each slide is laid out at a fixed width and then scaled to fill the
screen, so the longest passage and a three-word phrase both fill a 65" TV — and nothing
gets cut off in full screen, whatever the display's shape.
