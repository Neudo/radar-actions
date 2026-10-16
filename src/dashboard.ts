import { readFileSync } from "node:fs";
// Assets remain same-origin and authenticated. src/ is already included in the runtime image.
const asset = (name: string) =>
  readFileSync(new URL(`../src/dashboard/${name}`, import.meta.url), "utf8");
export const dashboardCSS = asset("style.css");
// Preserve the existing CSP (inline styles allowed, external styles forbidden).
export const dashboard = asset("index.html").replace(
  "<!-- dashboard-style -->",
  `<style>${dashboardCSS}</style>`,
);
export const dashboardJS = asset("client.js");
export const dashboardFormat = asset("format.js");
