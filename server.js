/**
 * Fitinerary — local development server
 *
 * Fitinerary is a fully static, client-side app (HTML/CSS/JS) — it does not
 * need a backend to run. This tiny Express server exists only for local
 * development, so you get the same request/response behavior you'd see on
 * GitHub Pages or any static host, instead of opening index.html via a
 * file:// URL (which can silently break relative asset paths and the
 * jsPDF/html2canvas fetches used for PDF export).
 *
 * Usage:
 *   npm install
 *   npm start
 *   → open http://localhost:3000
 *
 * Deploying to GitHub Pages does not use this file at all — Pages serves
 * index.html, css/, and script.js directly as static files.
 */

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything in this folder (index.html, css/, script.js) as static files.
app.use(express.static(path.join(__dirname), { extensions: ["html"] }));

// Fallback to index.html for the root and any unmatched route (single-page app).
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Fitinerary is running at http://localhost:${PORT}`);
});
