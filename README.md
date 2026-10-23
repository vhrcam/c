<p align="center">
  <img src="app/icon.svg" width="88" alt="The c logo, a single dry-brush stroke shaped like a C" />
</p>

<h1 align="center">c</h1>

<p align="center"><em>picture your memories</em></p>

<p align="center">
  Describe a moment that was never photographed, and c paints it in code,<br />
  stroke by stroke, then signs it.
</p>

---

**No AI image generator is involved.** AI only reads your words. Every brushstroke is drawn by c's own painting engine, so each painting is one of a kind, stays sharp at any size, and can paint itself again anytime.

## How it works

1. **Describe the moment.** Type it the way you'd tell it: *"our first kiss at sunset in a wide open field, her red dress and his navy suit."* Tap scenery tags, or do both. Tags on their own paint instantly.
2. **c reads it.** Gemini turns your words into a small scene recipe: the place, the time of day, the weather, the extras, the mood, and the people with their pose and what they wore. If you never said where or when, it asks one short question. Without an API key, a built-in word reader does the job.
3. **The painting paints itself.** c works the way a painter does, rough to fine and back to front.
4. **Change anything.** Tap a tag under the painting to swap it, like sunset to night, or type a change like *"make the sky pinker."* Only the part that changed gets repainted.

## The painting, in seven phases

| Phase | What you see |
|---|---|
| **Sketch** | Faint pencil lines rough out the horizon, the hills and the people |
| **Washes** | Soft sweeps of color fill the sky, then the ground |
| **Shapes** | Hills, trees, water and clouds build up from back to front |
| **Details** | A burst of grass, flowers, ripples and lit windows |
| **The moment** | It slows down for the people: outline first, then color |
| **Light** | The sun's glow spreads and a warm edge lights the people |
| **Signature** | A short pause, then a small c signs the corner |

About 25 seconds from blank paper to signature. You can watch at 2× or skip straight to the signature.

## Five styles

| Style | How it's painted |
|---|---|
| **Watercolor** | Translucent, slightly warped layers with pigment grain, fading softly into the paper |
| **Oil** | Thousands of short bristle dabs over an underpainting |
| **Storybook** | Clean, rounded shapes and soft gradients, like a picture book |
| **Ink** | Gray ink washes with a single red accent |
| **Pixel** | Low-resolution pixel art with a dithered retro palette |

When a painting finishes, the style row previews your own scene in all five.

## Seven places, any hour

- **Places:** meadow, beach, mountains, forest, lake, city rooftop and snowy hills
- **Times:** sunrise, daytime, golden hour, sunset and night
- **Weather:** clear, clouds, rain, falling snow and fog
- **Extras:** flowers, stars, fireflies, birds, trees, lanterns, northern lights and shooting stars
- **People:** standing, holding hands, kissing, hugging, sitting or walking, alone, as a couple or as a family, in the colors you describe

## Everything else

- **Fullscreen** with controls that hide themselves after two seconds. Press **F** for fullscreen and **Space** to pause. On iPhone it fills the browser window.
- **Versions:** every change is kept as a thumbnail you can go back to.
- **Gallery:** saved paintings stay in your browser. No account needed.
- **Share:** a link carries the whole scene, so whoever opens it watches it paint itself and sign, with your words underneath.
- **Download:** a full-size 2700 × 1800 image on paper, signature included.

## The painting engine

- A **scene recipe**, a few hundred bytes of JSON, holds everything: place, time, weather, extras, mood, pose, people and a seed.
- The **builder** turns the recipe into layered elements (sky, sun, hills, water, grass, people, light), each made of strokes placed on one timeline.
- Each style is a different **brush** that paints the same geometry.
- Big shapes are revealed through soft **masks**, like wavy sweeps, painted bands, growing circles and paths along a figure, so they look brushed on instead of fading in.
- The **player** bakes finished strokes into one image, so it only works on what's moving and stays smooth with thousands of strokes. It redraws at the screen's full resolution, which keeps fullscreen sharp on a big monitor.
- Every random choice comes from the seed, so a painting replays exactly the same way, and a change only repaints the elements whose inputs changed.

## Tools

| Piece | What it does |
|---|---|
| **Next.js** (App Router) + **Tailwind CSS** | The app and its scene API |
| **HTML Canvas** | The whole painting engine, written from scratch |
| **Google Gemini** (free tier, `gemini-3.5-flash`) | Reads descriptions and changes into scene recipes |
| **View Transitions API** | Glides the c from the intro into the header |
| **Instrument Serif** + **Geist** | Type |

## Run it locally

You need Node.js 20+ and, for the AI reader, a free [Gemini API key](https://aistudio.google.com).

```bash
git clone https://github.com/vhrcam/c.git
cd c
npm install
cp .env.example .env.local
```

Put your key in `.env.local` as `GEMINI_API_KEY`. Without one, c uses its built-in word reader. Then start it:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

[MIT](LICENSE). Instrument Serif is under the [SIL Open Font License](assets/fonts/OFL.txt).
