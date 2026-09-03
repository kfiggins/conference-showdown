# Making the read-aloud rounds sound better

The two listening rounds use the browser's built-in speech synthesiser. On a Mac with
only the stock voices, that sounds robotic — those are Apple's *compact* voices, a few
hundred kilobytes each, and they are the worst ones Apple ships.

Three ways to fix it, cheapest first.

## 1. Download a better system voice (free, ~5 minutes, biggest single improvement)

Apple ships good voices as optional downloads. They are much better than the compact
ones — full-size neural voices, tens of megabytes each.

1. **System Settings → Accessibility → Spoken Content → System Voice → Manage Voices…**
2. Under **English (US)**, download one of the **Premium** voices.
   Good ones for reading scripture: **Ava**, **Allison**, **Evan**, **Nathan**, **Tom**.
   (*Enhanced* is the middle tier and also a clear step up from the default.)
3. Reload the game and pick the new voice from **Reading voice** on the start screen.
   Press **Hear it** to compare. A ★ marks the higher-quality ones.

Worth knowing: **Safari usually exposes more of these voices to a web page than Chrome
does.** If a voice you downloaded doesn't appear in the picker in Chrome, open the game
in Safari and look again.

## 2. Pre-record the clips (consistent, offline, no browser differences)

Once you have a good voice installed, bake the audio into the site. The game then plays
a real file and never touches the synthesiser:

```sh
node tools/make-audio.mjs                    # show which voices you have
node tools/make-audio.mjs "Ava (Premium)"    # record all 24 clips
```

That writes `audio/<passage-id>.m4a` (the verse) and `audio/<passage-id>-doctrine.m4a`
(the doctrine phrase), plus an `audio/index.json` the game reads at start-up. Commit them
and they work in class with no internet and identically in every browser.

Roughly 2–4 MB for the full set.

## 3. Record a real voice (best, and free)

Nothing sounds better than a person, and for a seminary class a student reading the verse
is arguably the point. Any recording app works — Voice Memos, QuickTime, a phone.

1. Save one file per clip into `audio/`, named exactly:
   - `isa-53-3.m4a` — the verse for Isaiah 53:3–5
   - `isa-53-3-doctrine.m4a` — the doctrine phrase for it
   
   The ids are the `id` field in `data/passages.json`. `.m4a`, `.mp3`, and `.wav` all work.
2. Rebuild the index:
   ```sh
   node tools/make-audio.mjs --scan
   ```

Mix and match freely — the game uses a recorded clip when one exists for that passage and
falls back to the synthesiser when it doesn't. So you can record a few each week.

## What the game does with the text

Whichever voice is used, the app reads scripture in phrases rather than one long breath:
the text is split at sentence and clause boundaries and each piece is spoken separately,
so the pauses land where the punctuation is. Ellipses, em dashes, and curly quotes are
rewritten first, because most synthesisers either skip them or read them out loud.

**Reading speed** on the start screen defaults to 0.85×. Slower reads more reverently and
gives the class time to place the verse; much below 0.75× starts to sound artificial.
