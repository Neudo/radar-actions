import { readFileSync, readdirSync } from "node:fs";
// Vite's production build is required; no silent legacy fallback.
const directory = new URL("../dist/frontend/", import.meta.url);
const index = readFileSync(new URL("index.html", directory), "utf8");
export const dashboardAssets = new Map<
  string,
  { body: Buffer; type: string }
>();
for (const name of readdirSync(new URL("assets/", directory))) {
  if (!/^[a-zA-Z0-9_.-]+\.(js|css)$/.test(name)) continue;
  dashboardAssets.set(name, {
    body: readFileSync(new URL("assets/" + name, directory)),
    type: name.endsWith(".js")
      ? "application/javascript; charset=utf-8"
      : "text/css; charset=utf-8",
  });
}
// Preserve existing CSP: CSS inline, script modules same-origin and authenticated.
export const dashboard = index.replace(
  /<link[^>]*href="\/dashboard-app\/assets\/([^"/]+\.css)"[^>]*>/g,
  (_match, name) => {
    const asset = dashboardAssets.get(name);
    if (!asset) throw Error("Missing built stylesheet");
    return `<style>${asset.body.toString("utf8")}</style>`;
  },
);
