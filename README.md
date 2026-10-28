<p align="center">
  <img src="app/icon.svg" width="88" alt="The c logo, an italic lowercase c beside a block cursor" />
</p>

<h1 align="center">c</h1>

<p align="center"><em>describe anything</em></p>

<p align="center">
  Describe any idea. c reads it, chooses a system for every part of it,<br />
  and builds it into a living 3D artwork while you watch.
</p>

---

**c is not an AI image generator.** AI only reads your words and writes a plan. Every particle, filament, contour and wave is built by c's own engine from that plan, so the generation itself is the show, and every piece is one of a kind.

## How it works

1. **Describe anything.** A memory, a person, an animal, a place, a planet, an object, or something that never existed. Type it the way you'd say it: *"my dog running through autumn leaves at golden hour."*
2. **c reads it.** Gemini turns your words into a plan: the subjects, how they relate (*dog → through → leaves*), the world around them, the light, and the system that should build each part. While it reads, your words sit in the middle of the screen like a command waiting to run. When it understands them, the subjects light up and their relations draw between them.
3. **The artwork builds itself.** First a seed, then structure, form, detail, light and the world around it. A log types out what c understood and why it chose each system.
4. **It stays alive.** The finished piece keeps moving. In 3D you can orbit and zoom around it.

## The interface

- **One input.** A single line and generate. No tags, no settings.
- **The stage** fills the screen. The build phases tick by in one corner while c's reading types out in another. Pause, skip to the end or go fullscreen (**Space** and **F** work too).
- **When it's done**, save it, download a PNG, copy a share link, regenerate it with a new seed, or start a new one.
- **Share links** carry the whole plan, so whoever opens one watches the same artwork build.
- **Gallery:** saved works stay in your browser. No account needed.

## How c makes an artwork

1. **Understanding.** Gemini reads the description and writes a construction plan: the subjects, how they relate (under, facing, holding), the viewpoint, time, season, weather, light sources, particle systems, a palette, and why each subject gets the system it does. Offline, a keyword reader builds the same kind of plan.
2. **Form.** Every subject compiles to a signed distance field in GLSL. Animals come from a skeleton generator (species, pose, gait), people from a figure generator (build, hair, clothing, couple poses), and everything else from primitives the plan describes (ellipsoids, capsules, sweeps, lathes, tori, carved cuts). Trees grow by recursive branching, and planets are built in layers.
3. **Systems in 3D.** The GPU scatters points across each surface, then builds the subject in the language that fits it. Fur becomes thousands of filaments that follow the body, smooth objects are traced in contour slices, structures rise section by section, water is a field of Gerstner wave lines, and planets are strata of crust, ocean, cloud, city networks and orbits. Leaves, snow and rain ride a wind field, lamps pool light and drifting motes, and stars and a ringed moon fill the sky.
4. **Systems in 2D.** The same plan is raymarched into a flat shape map. From it c generates pixel art with hue-shifted ramps, outlines and ordered dithering, or draws the form as evenly spaced streamlines that wrap each shape.
5. **Generation is the show.** Seed, structure, form, detail, light, world, alive. Skeletons draw first, particles stream out from the subject's heart, fur grows, lamps flicker on, weather begins, and the finished piece keeps moving.

## Tools

| Piece | What it does |
|---|---|
| **Next.js** (App Router) + **Tailwind CSS** | The app and its interpret API |
| **three.js** + **GLSL** | The 3D engine and its distance fields |
| **HTML Canvas** | The 2D engine |
| **Google Gemini** (free tier, `gemini-3.5-flash`) | Reads descriptions into construction plans |
| **View Transitions API** | Carries the cursor and your words from the input onto the stage |
| **Geist** + **Geist Mono** | Type |

## Run it locally

You need Node.js 20+ and, for the AI reader, a free [Gemini API key](https://aistudio.google.com).

```bash
git clone https://github.com/vhrcam/c.git
cd c
npm install
cp .env.example .env.local
```

Put your key in `.env.local` as `GEMINI_API_KEY`. Without one, c reads your words with its built-in keyword reader. Then start it:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

[MIT](LICENSE). Geist Mono is under the [SIL Open Font License](assets/fonts/GeistMono-OFL.txt).
