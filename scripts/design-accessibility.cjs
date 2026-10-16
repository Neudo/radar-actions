// Local-only automated accessibility and rendered-token checks. Not a screen reader.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE_PATH ||
    "/home/debian/.hermes/node/lib/node_modules/@askjo/camofox-browser/node_modules/playwright-core",
);
const base = process.env.RADAR_PREVIEW_URL || "http://127.0.0.1:17846";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Preview only");
const line = fs
  .readFileSync(process.env.HOME + "/.hermes/.env", "utf8")
  .split(/\r?\n/)
  .find((l) => /^IR_READ_KEY=/.test(l));
if (!line) throw Error("Read credential unavailable");
const key = line
  .slice(line.indexOf("=") + 1)
  .trim()
  .replace(/^(['"])(.*)\1$/, "$2");
const cache = process.env.HOME + "/.cache/ms-playwright",
  dir = fs
    .readdirSync(cache)
    .find((n) => n.startsWith("chromium_headless_shell-"));
const out = "data/design";
const axe = fs.readFileSync(
  process.env.AXE_PATH || out + "/package/axe.min.js",
  "utf8",
);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      cache +
        "/" +
        dir +
        "/chrome-headless-shell-linux64/chrome-headless-shell",
    args: ["--no-sandbox"],
  });
  const report = [];
  try {
    const context = await browser.newContext({
      httpCredentials: { username: "radar", password: key },
      locale: "fr-FR",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
    const id = await page
      .locator("#rows [data-signal]")
      .first()
      .getAttribute("data-signal");
    for (const width of [1440, 390])
      for (const route of [
        "/dashboard",
        "/dashboard/bilan",
        "/dashboard/methode",
        "/dashboard/signaux/" + id,
      ]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(base + route, { waitUntil: "networkidle" });
        await page.evaluate(axe);
        const result = await page.evaluate(async () => {
          const r = await axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          });
          return {
            violations: r.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                summary: n.failureSummary,
              })),
            })),
            passes: r.passes.length,
            incomplete: r.incomplete.map((v) => v.id),
          };
        });
        report.push({ width, route, ...result });
      }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
    const controls = await page
      .locator("input:not([type=checkbox]),select,button")
      .evaluateAll((xs) =>
        xs
          .filter((x) => x.getBoundingClientRect().width && !x.disabled)
          .map((x) => ({
            id: x.id || x.name,
            height: x.getBoundingClientRect().height,
            width: x.getBoundingClientRect().width,
          })),
      );
    assert.ok(controls.every((x) => x.height >= 44));
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        [
          "paper",
          "surface",
          "graphite",
          "muted",
          "action",
          "focus",
          "control",
          "orange",
          "orange-wash",
          "green",
          "green-wash",
          "red",
          "red-wash",
        ].map((k) => [k, style.getPropertyValue("--" + k).trim()]),
      );
    });
    function luminance(hex) {
      const c = hex
        .replace("#", "")
        .match(/../g)
        .map((x) => parseInt(x, 16) / 255)
        .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    console.log("Rendered tokens", JSON.stringify(tokens));
    const pairs = [
      ["graphite", "paper"],
      ["muted", "paper"],
      ["graphite", "action"],
      ["focus", "paper"],
      ["control", "surface"],
      ["orange", "orange-wash"],
      ["green", "green-wash"],
      ["red", "red-wash"],
    ].map(([a, b]) => {
      const x = luminance(tokens[a]),
        y = luminance(tokens[b]);
      return {
        pair: a + "/" + b,
        ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05),
      };
    });
    assert.ok(
      pairs.every((p) => p.ratio >= (p.pair.startsWith("control") ? 3 : 4.5)),
    );
    await page.getByLabel("Rechercher une société ou un ticker").focus();
    const focus = await page
      .getByLabel("Rechercher une société ou un ticker")
      .evaluate((e) => ({
        style: getComputedStyle(e).outlineStyle,
        width: getComputedStyle(e).outlineWidth,
        color: getComputedStyle(e).outlineColor,
      }));
    assert.equal(focus.width, "3px");
    fs.writeFileSync(
      out + "/implementation-accessibility.json",
      JSON.stringify(
        {
          axeVersion: "4.10.3",
          report,
          controls,
          pairs,
          focus,
          limitations: [
            "Automated scanner and DOM/keyboard checks only; no real screen reader or native browser UI zoom test.",
          ],
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          views: report.length,
          violations: report.flatMap((r) => r.violations),
          pairs,
          focus,
        },
        null,
        2,
      ),
    );
    assert.ok(
      report.every((r) => !r.violations.length),
      "axe violations require review",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exit(1);
});
