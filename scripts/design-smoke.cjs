/* Reproducible local-only browser acceptance. Private evidence is ignored.
 * PLAYWRIGHT_CORE_PATH / CHROMIUM_PATH may override cached tooling paths.
 * Never records traces, authentication headers, storageState, or HAR. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE_PATH ||
    "/home/debian/.hermes/node/lib/node_modules/@askjo/camofox-browser/node_modules/playwright-core",
);
const base = process.env.RADAR_PREVIEW_URL || "http://127.0.0.1:17846";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Failure interception tests are local preview only");
const out = path.resolve("data/design");
fs.mkdirSync(out, { recursive: true });
const secret = fs
  .readFileSync(process.env.HOME + "/.hermes/.env", "utf8")
  .split(/\r?\n/)
  .find((l) => /^IR_READ_KEY=/.test(l));
if (!secret) throw Error("Read credential unavailable");
let key = secret
  .slice(secret.indexOf("=") + 1)
  .trim()
  .replace(/^(['"])(.*)\1$/, "$2");
const cache = process.env.HOME + "/.cache/ms-playwright";
const dir = fs
  .readdirSync(cache)
  .find((n) => n.startsWith("chromium_headless_shell-"));
const evidence = { checks: [], widths: [], errors: [], screenshots: [] };
const check = (label, fn) => {
  fn();
  evidence.checks.push(label);
};
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
  try {
    const context = await browser.newContext({
      httpCredentials: { username: "radar", password: key },
      locale: "fr-FR",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => evidence.errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /Content Security Policy|Refused to/.test(m.text())
      )
        evidence.errors.push(m.text());
    });
    const wait = () =>
      page.waitForFunction(
        () =>
          document.querySelector("#rows").getAttribute("aria-busy") === "false",
      );
    const goto = async (url = "/dashboard") => {
      await page.goto(base + url, { waitUntil: "networkidle" });
    };
    const shot = async (name) => {
      await page.screenshot({
        path: out + "/" + name + ".png",
        fullPage: true,
      });
      evidence.screenshots.push("data/design/" + name + ".png");
      await page.screenshot({
        path: out + "/" + name + "-viewport.png",
        fullPage: false,
      });
    };
    const width = async (label) => {
      const w = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      evidence.widths.push({ label, ...w });
      if (w.scrollWidth > w.width) {
        evidence.overflow = await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right > innerWidth + 1 &&
                e.getBoundingClientRect().width > 0,
            )
            .map((e) => ({
              tag: e.tagName,
              id: e.id,
              class: e.className,
              right: e.getBoundingClientRect().right,
              width: e.getBoundingClientRect().width,
            })),
        );
        await shot("overflow-failure");
        console.log(JSON.stringify(evidence.overflow));
      }
      assert.ok(
        w.scrollWidth <= w.width,
        label + " document overflow " + JSON.stringify(w),
      );
    };
    await goto();
    await wait();
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      ),
      "rgb(245, 242, 233)",
      "the existing CSP must allow the rendered paper styles",
    );
    await shot("after-desktop");
    await width("signals desktop");
    check("real signal cohort and stale/degraded status", async () => {});
    assert.match(
      await page.locator("#result-summary").innerText(),
      /40 signaux/,
    );
    assert.match(
      await page.locator("#trust-title").innerText(),
      /Suivi ancien.*dégradé/,
    );
    assert.equal(await page.locator(".quarantine").count(), 22);
    assert.equal(
      await page
        .locator(".excluded")
        .filter({ hasText: "quarantaine" })
        .count(),
      22,
    );
    evidence.checks.push("22 quarantined rows have excluded returns");
    await page.locator("#trust-details summary").click();
    assert.match(
      await page.locator("#trust-body").innerText(),
      /État non exposé/,
    );
    await page.locator("#trust-details summary").click();
    for (const w of [320, 390, 768, 1024, 1280, 1920]) {
      await page.setViewportSize({ width: w, height: 844 });
      await width("signals " + w);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#columns").selectOption("checkpoints");
    for (const w of [768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await width("checkpoints " + w);
    }
    await shot("after-checkpoints-desktop");
    await page.locator("#columns").selectOption("essential");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("after-mobile");
    await page.locator("#filter-disclosure summary").first().click();
    await width("mobile filters open 390");
    await page.setViewportSize({ width: 320, height: 844 });
    await width("mobile filters open 320");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#filter-disclosure summary").first().click();
    assert.equal(await page.locator(".signal-card").count(), 40);
    assert.equal(await page.locator(".register-table").count(), 0);
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const term of ["NVDA", "nvda", "Nvidia"]) {
      await page.getByLabel("Rechercher une société ou un ticker").fill(term);
      await page.getByRole("button", { name: "Appliquer" }).click();
      await wait();
      assert.match(
        await page.locator("#result-summary").innerText(),
        /2 signaux/,
      );
      assert.equal(await page.locator("#rows a[data-signal]").count(), 2);
    }
    evidence.checks.push("NVDA / nvda / Nvidia find same two real signals");
    await page
      .getByLabel("Rechercher une société ou un ticker")
      .fill("no-such-company-test");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await wait();
    assert.match(
      await page.locator("#rows").innerText(),
      /Aucun signal pour ces filtres/,
    );
    evidence.checks.push("empty selection distinct from error");
    await page.locator("#reset").click();
    await wait();
    await page.locator("#more-filters summary").click();
    await page
      .getByRole("combobox", { name: "État du suivi", exact: true })
      .selectOption("quarantined");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await wait();
    assert.match(
      await page.locator("#result-summary").innerText(),
      /22 signaux/,
    );
    await page.locator("#reset").click();
    await wait();
    await page.locator("#limit").selectOption("25");
    await wait();
    assert.match(
      await page.locator("#page-summary").innerText(),
      /1–25 sur 40/,
    );
    await page.locator("#next").click();
    await wait();
    assert.match(
      await page.locator("#page-summary").innerText(),
      /26–40 sur 40/,
    );
    assert.equal(await page.locator("#next").isDisabled(), true);
    await page.locator("#prev").click();
    await wait();
    await page.locator("#sort").selectOption("company_asc");
    await wait();
    assert.match(
      await page.locator("#rows a[data-signal]").first().innerText(),
      /^ABNB/,
    );
    await page.locator("#reset").click();
    await wait();
    evidence.checks.push("global tracking filter, pagination and company sort");
    const header = page.getByRole("button", {
      name: "Trier par Analyse",
      exact: true,
    });
    await header.focus();
    await page.keyboard.press("Enter");
    await wait();
    assert.equal(
      await header.evaluate((e) => document.activeElement === e),
      true,
      "sorting keeps keyboard focus on its header",
    );
    evidence.checks.push("header sorting preserves keyboard focus");
    await page.getByLabel("Du", { exact: true }).fill("2026-10-10");
    await page.getByLabel("Au", { exact: true }).fill("2026-10-01");
    await page.getByRole("button", { name: "Appliquer" }).click();
    assert.match(
      await page.locator("#filter-error").innerText(),
      /doit suivre/,
    );
    await page.locator("#reset").click();
    await wait();
    evidence.checks.push("date validation inline");
    // Keyboard search and detail navigation, returning focus to the actual source link.
    await page.getByLabel("Rechercher une société ou un ticker").focus();
    await page.keyboard.type("AAPL");
    await page.keyboard.press("Enter");
    await wait();
    const target = page.locator("#rows a[data-signal]").first();
    const id = await target.getAttribute("data-signal");
    await target.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document.querySelector("#detail").getAttribute("aria-busy") === "false",
    );
    assert.match(
      await page.locator("#detail").innerText(),
      /Performance exclue/,
    );
    assert.match(
      await page.locator("#detail").innerText(),
      /Publication non établie/,
    );
    assert.match(
      await page.locator("#detail").innerText(),
      /ORANGE de qualité de recherche, non signal positif/,
    );
    assert.equal(
      await page
        .locator("#page-title")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await shot("after-detail-desktop");
    for (const w of [320, 390, 768, 1024, 1280, 1920]) {
      await page.setViewportSize({ width: w, height: 844 });
      await width("detail " + w);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("after-detail-mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("[data-back]").click();
    await wait();
    await page.waitForTimeout(250);
    assert.equal(
      await page
        .locator("#signal-" + id)
        .evaluate((e) => e === document.activeElement),
      true,
    );
    assert.equal(
      await page.getByLabel("Rechercher une société ou un ticker").inputValue(),
      "AAPL",
    );
    evidence.checks.push(
      "keyboard detail / source dates / exclusion / focus and selection return",
    );
    await goto("/dashboard/signaux/" + id + "?search=AAPL");
    await page.waitForFunction(
      () =>
        document.querySelector("#detail").getAttribute("aria-busy") === "false",
    );
    assert.match(
      await page.locator("#detail").innerText(),
      /Pourquoi ce classement/,
    );
    evidence.checks.push("direct signal URL");
    await goto("/dashboard/bilan");
    await page.waitForFunction(
      () =>
        document.querySelector("#analytics").getAttribute("aria-busy") ===
        "false",
    );
    assert.match(
      await page.locator("#analytics").innerText(),
      /Pas encore de résultat à J30/,
    );
    assert.match(
      await page.locator("#analytics").innerText(),
      /Non calculable · n=0/,
    );
    assert.match(
      await page.locator("#analytics").innerText(),
      /22 en quarantaine/,
    );
    await shot("after-bilan-desktop");
    for (const w of [320, 390, 768, 1024, 1280, 1920]) {
      await page.setViewportSize({ width: w, height: 844 });
      await width("analytics " + w);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("after-bilan-mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
    evidence.checks.push(
      "checkpoint sample sizes and native currency breakdown",
    );
    await goto("/dashboard/methode");
    await page.waitForFunction(
      () =>
        document.querySelector("#runs").getAttribute("aria-busy") === "false",
    );
    assert.equal(await page.locator("#runs details").count(), 2);
    await page.locator("#runs summary").first().click();
    assert.ok(
      (await page.locator("#runs pre").first().innerText()).length > 100,
    );
    await shot("after-method-desktop");
    for (const w of [320, 390]) {
      await page.setViewportSize({ width: w, height: 844 });
      await width("method " + w);
    }
    evidence.checks.push("method and real immutable run reports");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await goto();
    // Only intercept GET reads; never induce service or database failures.
    for (const status of [401, 400, 429, 500]) {
      await page.route("**/api/v1/radar/signals?*", (r) =>
        r.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ error: "explicit browser interception" }),
        }),
      );
      await page.getByLabel("Rechercher une société ou un ticker").fill("NVDA");
      await page.getByRole("button", { name: "Appliquer" }).click();
      await wait();
      assert.match(
        await page.locator("#signals-error").innerText(),
        status === 401
          ? /Accès à renouveler/
          : status === 400
            ? /Sélection invalide/
            : status === 429
              ? /Trop de requêtes/
              : /Impossible de charger/,
      );
      assert.match(
        await page.locator("#signals-error").innerText(),
        /Dernier résultat affiché/,
      );
      await page.unroute("**/api/v1/radar/signals?*");
      await page.locator("#signals-error button").click();
      await wait();
      assert.equal(await page.locator("#signals-error").innerText(), "");
    }
    evidence.checks.push(
      "401 / 400 / 429 / 500 isolated regional errors with retry and previous results",
    );
    // Delayed earlier response must never win after a later applied search.
    await page.route("**/api/v1/radar/signals?*", async (r) => {
      if (new URL(r.request().url()).searchParams.get("search") === "NVDA") {
        const response = await r.fetch();
        await new Promise((resolve) => setTimeout(resolve, 600));
        try {
          await r.fulfill({ response });
        } catch {}
      } else await r.continue();
    });
    await page.getByLabel("Rechercher une société ou un ticker").fill("NVDA");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await page.getByLabel("Rechercher une société ou un ticker").fill("AAPL");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await wait();
    await page.waitForTimeout(750);
    assert.match(
      await page.locator("#rows a[data-signal]").first().innerText(),
      /^AAPL/,
    );
    await page.unroute("**/api/v1/radar/signals?*");
    evidence.checks.push(
      "late obsolete search response cannot replace latest applied selection",
    );
    // Effective CSS viewport reflow equivalents, not a claim of native browser
    // UI zoom or assistive-technology testing in headless Chromium.
    for (const zoom of [2, 4]) {
      await page.setViewportSize({ width: 1440 / zoom, height: 1000 });
      await width("reflow equivalent " + zoom * 100 + "%");
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.deepEqual(evidence.errors, []);
    evidence.checks.push("no browser pageerror");
    fs.writeFileSync(
      out + "/implementation-browser.json",
      JSON.stringify(evidence, null, 2),
    );
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  fs.writeFileSync(
    out + "/implementation-browser-failure.json",
    JSON.stringify({ error: e.message, stack: e.stack, evidence }, null, 2),
  );
  console.error(e.stack);
  process.exit(1);
});
