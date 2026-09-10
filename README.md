# Fitinerary

**Your personal diet planner.**

Fitinerary computes an adult BMI screening estimate and BMI reference-weight range, then generates a full 7-day, 21-meal plan tuned toward an estimated calorie target and general macro guide — with cuisine and dietary filters, scaled recipes, an aggregated grocery list, and a one-tap downloadable PDF report.

## Features

- **Step 1 — Your numbers.** Adults enter age, sex, activity level, height, and weight (metric and imperial fields stay synchronized). The app reports BMI as a screening estimate and translates the adult BMI reference range to the entered height.
- **Step 2 — Your target.** Set a weight-loss or maintenance target and weekly pace. Fitinerary estimates resting energy with the Mifflin–St Jeor equation, applies the selected activity factor, and clearly labels the result as an estimate. This general-purpose version does not generate a target above the current weight or below the adult BMI reference range.
- **7-day, 21-meal plan.** Meals are pulled from a built-in recipe set spanning Western, Asian, Philippine (PH local), Halal, and Kosher options, with a seafood-free filter. A daily optimizer selects and scales meals toward both the calorie target and a general macro planning guide.
- **Recipe guide.** Every planned meal includes its exact portion multiplier and scaled ingredient quantities matching the nutrition displayed for that meal.
- **Grocery list.** Measured quantities are mathematically aggregated across all 21 scaled portions, including repeats. Unmeasured ingredients are honestly marked "as needed."
- **PDF export.** Generates a real, downloadable PDF (via jsPDF + html2canvas) laid out for mobile/phone-width reading — no print dialog involved. The button now shows visible progress plus inline success or recovery guidance.
- **Focused three-step flow.** Each stage has one dominant action. Later stages stay hidden until relevant, while units, activity, cuisine filters, regeneration, and editing remain available as secondary disclosed options.

## Project structure

```
fitinerary/
├── index.html       # App markup
├── css/
│   └── styles.css   # All styling (claymorphism UI, wellness palette)
├── script.js         # App logic — BMI/TDEE math, meal database, plan builder, PDF export
├── server.js          # Minimal Express server for local development only
├── package.json
├── LICENSE
└── README.md
```

## Running locally

Fitinerary is a fully static, client-side app — no backend or database is required. `server.js` is included only so local development behaves like a real static host (GitHub Pages, etc.) rather than opening `index.html` via a `file://` URL, which can break relative paths and PDF export.

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

## Deploying to GitHub Pages

No build step is needed — `server.js` and `package.json` are not used by Pages.

1. Push this repository to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, choose your default branch and the `/ (root)` folder.
4. Save. Your site will publish at `https://<your-username>.github.io/<repo-name>/`.

## Tech notes

- Vanilla HTML/CSS/JS — no framework, no build tooling.
- External dependencies are loaded via CDN in `index.html`: Google Fonts (Fraunces, Inter, JetBrains Mono), [html2canvas](https://github.com/niklasvh/html2canvas), and [jsPDF](https://github.com/parallax/jsPDF).
- Meal and recipe data lives inline in `script.js` (`MEALS` object) — edit it directly to add, remove, or adjust recipes, cuisines, or macros.
- All calorie/macro math (Mifflin–St Jeor estimate, activity factor, planner floor, macro guide and portion scaling) is in `script.js` and runs entirely client-side.
- Recipe nutrition remains an estimate: brands, cooked yield, substitutions and preparation methods change actual values.

## Disclaimer

Fitinerary is a planning aid, not medical or religious dietary advice. Halal and kosher tags reflect ingredient choice only — they are not certified and do not account for preparation method. Consult a clinician before starting a weight-loss program.

---

**KELBRIC TECHNOLOGIES**
[github.com/kelbrictech](https://github.com/kelbrictech) · FB: [@thetechnaitive](https://facebook.com/thetechnaitive)

See [LICENSE](./LICENSE) — view-only, all rights reserved.
