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

**c is not an AI image generator.** AI only reads your words and writes a plan. Every edge, particle, surface and wave is built by c's own engine from that plan, so the generation itself is the show, and every piece is one of a kind.

## How it works

1. **Describe anything.** Right now c builds buildings, vehicles, trees, planets and objects in their landscapes, with more categories on the way. Type it the way you'd say it: *"a steam train crossing a stone bridge in the fog."*
2. **c reads it.** Gemini turns your words into a plan: the subjects, how they relate (*train → on → bridge*), the world around them, the light, and the system that should build each part. While it reads, your words sit in the middle of the screen like a command waiting to run. When it understands them, the subjects light up and their relations draw between them.
3. **The artwork builds itself.** First a seed, then structure, form, detail, light and the world around it. A log types out what c understood and why it chose each system.
4. **It stays alive.** The finished piece keeps moving. In 3D you can orbit and zoom around it.

## The interface

- **One input.** A single line and generate. No tags, no settings.
- **The stage** fills the screen. The build phases tick by in one corner while c's reading types out in another. Pause, skip to the end or go fullscreen (**Space** and **F** work too).
- **When it's done**, save it, download a PNG, copy a share link, regenerate it with a new seed, or start a new one.
- **Share links** carry the whole plan, so whoever opens one watches the same artwork build.
- **Gallery:** saved works stay in your browser. No account needed.

## How c makes an artwork

1. **Understanding.** Gemini turns the description into a construction plan: what each subject is (a building style, a vehicle type, a tree, a planet or an object made of primitives), how the subjects relate (a train on a bridge), the time, season, weather, lights and palette, and whether it's one thing on its own or a whole scene. Offline, a keyword reader builds the same kind of plan.
2. **Form.** Buildings come from architectural recipes (porches, dormers, shutters, window boxes, roof slopes, porticos, battlements, spires, arches), and each regeneration varies the colors, porch, roof pitch and wings. Vehicles are profile-extruded bodies with real wheels, glass and lights, and the recipes run all the way to a three-masted galleon. Objects are signed distance fields meshed with marching cubes. Trees grow by recursive branching, and planets are built in layers.
3. **Construction.** Edges draw themselves, particles stream from the subject's heart onto its surface and fade as it fills in with a fixed grain, and at night the windows light up.
4. **World.** A lone subject stands by itself. A scene is built on a compact round stage with a solid base. The countryside grows into a patchwork of wheat, lavender and plowed fields with crop rows, swaying grass, wildflowers and branching hedgerow trees. A city lays out a street grid, mid-rises and towers that fall off from the center, rooftop tanks, streetlights and traffic. Water is Gerstner waves, storms roll in a cloud bank with lightning, and the light follows the time of day.

## Tools

| Piece | What it does |
|---|---|
| **Next.js** (App Router) + **Tailwind CSS** | The app and its interpret API |
| **three.js** + **GLSL** | The 3D engine and its distance fields |
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
