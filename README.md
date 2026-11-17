<p align="center">
  <img src="app/icon.svg" width="88" alt="The c logo, an italic lowercase c beside a block cursor" />
</p>

<h1 align="center">c</h1>

<p align="center"><em>describe anything</em></p>

<p align="center">
  Describe anything you can picture: a memory, a person, an animal, a place.<br />
  c reads it, blocks the scene out, and draws it in thousands of lines while you watch.<br />
  <strong>Live at <a href="https://ccreate.vercel.app">ccreate.vercel.app</a></strong>
</p>

---

**c is not an AI image generator.** No image model is involved and no pixel comes from AI. A language model reads your words and says what is in the scene and where, the way a director blocks a stage. Every line after that is computed by c's own code in your browser, so the drawing is the show and no two pieces come out the same.

## How it works

1. **Describe it.** Type it the way you'd say it: *"me and her watching the sunset"*, *"my dog waiting at the door when I came home"*, *"my grandmother's kitchen on a sunday morning"*. People, animals, places, objects and weather all work.
2. **c reads it.** Your words sit in the middle of the screen like a command waiting to run. A log shows what the director is thinking about, and each word lights up as the thing it names is placed in the scene.
3. **The artwork builds itself.** First a faint construction sketch of the blocking, then the ground and sky, then each form printed from its base up, then hair, fur and grass, then light and weather. A log types out what c read and what it is drawing with.
4. **It signs it.** When the last line is down, c signs the corner. Save it to your gallery, download a PNG or an SVG, copy a share link, or regenerate for a different take on the same words.

## How c makes a picture

**The director.** Gemini gets a brief and answers with a *score*: every thing in the scene as a few plain shapes (bands for land and sea, tubes for limbs and trunks, blobs, outlines), each with a substance and a color. It also gives the hour, the weather, where the light comes from and a small palette. That is all the AI does.

**No stored drawings.** Nothing in c's code knows what a person, a dog or a kitchen looks like. There are no rigs, sprites or templates. What c knows is how thirty-odd substances take a line: skin, hair, fur, cloth, wood, stone, water, glass, foliage, fire and so on. Anything the director can block out of shapes, c can draw.

**One relief.** c turns the whole scene into a single bas-relief. Clouds swell the sky, waves ripple the water, and each body is a soft cushion over its silhouette with every part standing a little prouder than the one behind it. Small parts on a soft surface, like the eyes and mouth on a face, are modeled into that surface instead of being stuck on top, and a garment re-covers the body under it.

**Level lines.** A family of parallel planes cuts the relief, and the cuts are the drawing. The tone of each place decides how many cuts it keeps and how wide each one is inked, so light and shade come from line weight alone. Hair, fur, grass and flames are grown as strands along a flow instead. Shadows fall along the ground away from the light, still water holds a broken reflection, and lamps tint the lines around them.

**Paper and ink.** Every color the director names is re-cut against the sheet: dark inks on warm white paper, pale inks on black paper for night scenes.

**A temper of its own.** Each piece rolls how its planes lean and sway, how the sky behaves, how heavy the pen is, how many inks go on the press (full color, two inks, or a grey world with only the subject in color), how the sheet is finished, and one small accident: threads trailing downwind off the subject, or echoes of its outline.

**Built in the open.** The strokes are scheduled on a timeline and drawn one at a time on a canvas. The finished piece is nothing but strokes, which is why it can also leave as an SVG.

## The interface

- **One input.** A single line and generate. No tags, no settings.
- **The stage** takes the color of the paper. The build phases tick by in one corner while the log types out in another. Pause, skip to the end or go fullscreen (**Space** and **F** work too).
- **Share links** carry the whole score, so whoever opens one watches the same artwork build.
- **Gallery:** saved works stay in your browser. No account needed.

## Tools

| Piece | What it does |
|---|---|
| **Next.js** (App Router) + **Tailwind CSS** | The app and the route that talks to the director |
| **Canvas 2D** | Draws every stroke; the engine in `lib/draw` is plain JavaScript with no dependencies |
| **Google Gemini** (free tier) | The director: reads a description into a score, streamed so you can watch it think |
| **View Transitions API** | Carries the cursor and your words from the input onto the stage |
| **Geist** + **Geist Mono** | Type |

## Run it locally

You need Node.js 20+ and a free [Gemini API key](https://aistudio.google.com).

```bash
git clone https://github.com/vhrcam/c.git
cd c
npm install
cp .env.example .env.local
```

Put your key in `.env.local` as `GEMINI_API_KEY`, then start it:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The free tier allows about 20 requests a day on the main model. When that runs out c falls back to other Gemini models, and with no key at all it can still read the place, the hour and the weather out of your words and draw the setting.

## The bench

`lab/draw.mjs` runs the engine without a browser, which is how it gets tuned:

```bash
node --env-file=.env.local lab/draw.mjs ask "walking my dog in the rain" dog   # ask the director, save the score
node lab/draw.mjs flat dog                                                      # see the raw blocking
node lab/draw.mjs render dog 3,5,8                                              # render it at three seeds
```

Renders land in `lab/runs/draw`.

## Also in the repo

`lib/engine` holds a 3D engine from an earlier version of c. It is switched off in the app for now and marked "3d soon".

## License

[MIT](LICENSE). Geist Mono is under the [SIL Open Font License](assets/fonts/GeistMono-OFL.txt).
