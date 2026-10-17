// Automated Chromium/axe evidence; not a screen-reader certification.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE_PATH ||
    "/home/debian/.hermes/node/lib/node_modules/@askjo/camofox-browser/node_modules/playwright-core",
);
const base = process.env.RADAR_PREVIEW_URL || "http://127.0.0.1:17847";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Loopback only");
const line = fs
  .readFileSync(process.env.HOME + "/.hermes/.env", "utf8")
  .split(/\r?\n/)
  .find((l) => /^IR_READ_KEY=/.test(l));
const key = line
  .slice(line.indexOf("=") + 1)
  .trim()
  .replace(/^(['"])(.*)\1$/, "$2");
const cache = process.env.HOME + "/.cache/ms-playwright",
  dir = fs
    .readdirSync(cache)
    .find((n) => n.startsWith("chromium_headless_shell-")),
  out = "data/design",
  axe = fs.readFileSync(
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
  const report = { views: [], controls: [], keyboard: [], errors: [] };
  try {
    const context = await browser.newContext({
      httpCredentials: { username: "radar", password: key, send: "always" },
      locale: "fr-FR",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    const signals = await (
      await context.request.get(base + "/api/v1/radar/signals?limit=500")
    ).json();
    const eligible = signals.items.find(
        (s) =>
          !["quarantined", "missing"].includes(s.tracking_status) &&
          s.data_status !== "missing" &&
          s.payload?.assessment_status !== "unknown",
      ),
      quarantine = signals.items.find(
        (s) => s.tracking_status === "quarantined",
      );
    assert.ok(eligible && quarantine);
    const scan = async (label) => {
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
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          incomplete: r.incomplete.map((v) => v.id),
          passes: r.passes.length,
        };
      });
      report.views.push({ label, ...result });
    };
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of [
        "/dashboard",
        "/dashboard/bilan",
        "/dashboard/methode",
        "/dashboard/signaux/" + eligible.id,
        "/dashboard/signaux/" + quarantine.id,
      ]) {
        await page.goto(base + route, { waitUntil: "networkidle" });
        await scan(width + " " + route);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "État du suivi", exact: true })
      .click();
    await scan("1440 Dialog open");
    await page.keyboard.press("Escape");
    await page.locator("#filter-tag").focus();
    await page.keyboard.press("Space");
    await scan("1440 Select open");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(
      await page
        .locator("#filter-tag")
        .evaluate((e) => document.activeElement === e),
      true,
    );
    report.keyboard.push("Select keyboard and restored focus");
    const controls = await page
      .locator("button,input:not([type=checkbox])")
      .evaluateAll((xs) =>
        xs
          .filter((e) => e.getClientRects().length)
          .map((e) => ({
            name: e.getAttribute("aria-label") || e.id || e.textContent.trim(),
            height: e.getBoundingClientRect().height,
            outline: getComputedStyle(e).outlineWidth,
          })),
      );
    report.controls = controls;
    assert.ok(
      controls.every((c) => c.height >= 44),
      "44px rendered visible controls",
    );
    await page.goto(base + "/dashboard/signaux/" + eligible.id, {
      waitUntil: "networkidle",
    });
    const chart = page.locator('.recharts-surface[tabindex="0"]');
    await chart.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.locator(".chart-tooltip-provenance").waitFor();
    report.keyboard.push("Recharts actual-data keyboard tooltip");
    await scan("1440 chart tooltip keyboard");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
    await page.locator(".mobile-filters-summary").click();
    await page
      .locator("summary")
      .filter({ hasText: "Plus de filtres" })
      .click();
    await scan("390 expanded filters");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(report.errors, []);
    assert.equal(
      report.views.reduce((n, v) => n + v.violations.length, 0),
      0,
      "axe violations",
    );
    console.log(
      JSON.stringify({
        views: report.views.length,
        violations: 0,
        keyboard: report.keyboard,
        controls: report.controls.length,
      }),
    );
  } finally {
    fs.writeFileSync(
      out + "/react-accessibility.json",
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
