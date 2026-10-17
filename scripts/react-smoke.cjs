// Local authenticated browser checks only. No secrets/traces/session exports.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE_PATH ||
    "/home/debian/.hermes/node/lib/node_modules/@askjo/camofox-browser/node_modules/playwright-core",
);
const base = process.env.RADAR_PREVIEW_URL || "http://127.0.0.1:17847";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Loopback preview required");
const line = fs
  .readFileSync(process.env.HOME + "/.hermes/.env", "utf8")
  .split(/\r?\n/)
  .find((l) => /^IR_READ_KEY=/.test(l));
if (!line) throw Error("Missing credential");
const key = line
  .slice(line.indexOf("=") + 1)
  .trim()
  .replace(/^(['"])(.*)\1$/, "$2");
const cache = process.env.HOME + "/.cache/ms-playwright",
  dir = fs
    .readdirSync(cache)
    .find((n) => n.startsWith("chromium_headless_shell-"));
const out = "data/design",
  report = { checks: [], widths: [], errors: [], screenshots: [] };
fs.mkdirSync(out, { recursive: true });
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
      httpCredentials: { username: "radar", password: key, send: "always" },
      locale: "fr-FR",
      hasTouch: true,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /Content Security Policy|Refused to/.test(m.text())
      )
        report.errors.push(m.text());
    });
    const check = (s) => report.checks.push(s),
      go = async (path = "/dashboard") => {
        await page.goto(base + path, { waitUntil: "networkidle" });
      };
    const wait = () =>
      page.waitForFunction(
        () =>
          document.querySelector("#rows")?.getAttribute("aria-busy") ===
          "false",
      );
    const choose = async (id, label) => {
      await page.locator("#" + id).click();
      await page.getByRole("option", { name: label, exact: true }).click();
      await page.waitForLoadState("networkidle");
    };
    const shot = async (name) => {
      await page.screenshot({
        path: out + "/" + name + ".png",
        fullPage: true,
      });
      await page.screenshot({ path: out + "/" + name + "-viewport.png" });
      report.screenshots.push(out + "/" + name + ".png");
    };
    const width = async (label) => {
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      const w = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      report.widths.push({ label, ...w });
      assert.ok(
        w.scrollWidth <= w.width,
        label + ": overflow " + w.scrollWidth,
      );
    };
    const signals = await (
      await context.request.get(base + "/api/v1/radar/signals?limit=500")
    ).json();
    report.observed = { signals: signals.total };
    await go();
    await wait();
    assert.equal(
      await page.locator("#rows [data-signal]").count(),
      Math.min(signals.total, 50),
    );
    assert.match(
      await page.locator("#result-summary").innerText(),
      new RegExp("^" + signals.total + " signaux"),
    );
    check("React register actual API totals");
    assert.equal(await page.locator("[data-slot=table]").count(), 1);
    assert.equal(
      (await page.locator("[data-slot=select-trigger]").count()) > 0,
      true,
    );
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
      "rgba(0, 0, 0, 0)",
    );
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      ),
      "rgb(245, 242, 233)",
    );
    await shot("react-register-desktop");
    await page
      .getByRole("button", { name: "État du suivi", exact: true })
      .click();
    assert.ok(await page.getByRole("dialog").isVisible());
    assert.match(
      await page.getByRole("dialog").innerText(),
      /activité inconnue/,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "État du suivi", exact: true })
        .evaluate((e) => document.activeElement === e),
      true,
    );
    check("Radix Dialog keyboard escape and focus restoration");
    for (const q of ["NVDA", "nvda", "Nvidia"]) {
      await page.getByLabel("Rechercher une société ou un ticker").fill(q);
      await page.getByRole("button", { name: "Appliquer" }).click();
      await wait();
      const expected = signals.items.filter((s) =>
        (s.ticker + " " + s.company).toLowerCase().includes(q.toLowerCase()),
      ).length;
      assert.equal(await page.locator("#rows [data-signal]").count(), expected);
      assert.ok(expected > 0);
    }
    check("case-insensitive global ticker and company search");
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await wait();
    await choose("limit", "25");
    await wait();
    const first = await page
      .locator("#rows [data-signal]")
      .evaluateAll((xs) => xs.map((x) => x.dataset.signal));
    if (signals.total > 25) {
      await page.getByRole("button", { name: "Suivant", exact: true }).click();
      await wait();
      const next = await page
        .locator("#rows [data-signal]")
        .evaluateAll((xs) => xs.map((x) => x.dataset.signal));
      assert.ok(next.every((id) => !first.includes(id)));
      assert.equal(first.length + next.length, Math.min(50, signals.total));
    }
    check("real pagination with no duplicate rows");
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await wait();
    await choose("sort", "Société A–Z");
    await wait();
    assert.match(page.url(), /sort=company_asc/);
    check("Radix global sort");
    const origin = page.locator("#rows [data-signal]").first(),
      originId = await origin.getAttribute("data-signal");
    await origin.focus();
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Retour à la sélection" }).click();
    await wait();
    assert.equal(
      await page
        .locator('[data-signal="' + originId + '"]')
        .evaluate((e) => document.activeElement === e),
      true,
    );
    assert.match(page.url(), /sort=company_asc/);
    check("keyboard full-page detail and exact filtered return focus");
    await page
      .locator("summary")
      .filter({ hasText: "Plus de filtres" })
      .click();
    await choose("filter-tracking", "Quarantaine");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await wait();
    assert.equal(
      await page.locator("#rows [data-signal]").count(),
      signals.items.filter((s) => s.tracking_status === "quarantined").length,
    );
    assert.equal(
      await page
        .locator("#rows")
        .getByText(/Exclu · quarantaine/)
        .count(),
      signals.items.filter((s) => s.tracking_status === "quarantined").length,
    );
    check("quarantine filter and suppressed returns");
    await page.locator("#from").fill("2026-10-20");
    await page.locator("#to").fill("2026-10-01");
    await page.getByRole("button", { name: "Appliquer" }).click();
    assert.match(
      await page.locator("#filter-error").innerText(),
      /doit suivre/,
    );
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await wait();
    assert.equal(await page.locator("#from").inputValue(), "");
    check("invalid dates and React controlled reset");
    await page
      .getByRole("button", { name: "Points de contrôle", exact: true })
      .click();
    assert.equal(
      await page.locator("#rows th").getByText("J30", { exact: true }).count(),
      1,
    );
    await width("desktop checkpoints");
    await page.getByRole("button", { name: "Essentiel", exact: true }).click();
    for (const w of [320, 390, 768, 1024, 1280, 1920]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await width("register " + w);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("react-register-mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const active = signals.items.find(
      (s) =>
        s.tracking_status !== "quarantined" &&
        s.tracking_status !== "missing" &&
        s.data_status !== "missing" &&
        s.payload?.assessment_status !== "unknown",
    );
    assert.ok(active, "real eligible signal required");
    const detail = await (
      await context.request.get(base + "/api/v1/radar/signals/" + active.id)
    ).json();
    report.observed.chart = {
      ticker: active.ticker,
      observations: detail.observations.length,
    };
    await go("/dashboard/signaux/" + active.id + "?search=" + active.ticker);
    assert.equal(await page.locator("[data-slot=chart]").count(), 1);
    await page.locator(".evolution-chart").scrollIntoViewIfNeeded();
    const dots = page.locator(".recharts-line-dots circle");
    assert.equal(await dots.count(), detail.observations.length + 1);
    await dots.last().hover({ force: true });
    await page.locator(".chart-tooltip-provenance").waitFor();
    const tooltip = await page.locator(".chart-tooltip-provenance").innerText();
    assert.match(tooltip, /Source :/);
    assert.match(tooltip, /Observation :/);
    assert.match(tooltip, new RegExp(active.currency));
    await shot("react-chart-tooltip-desktop");
    await page.getByRole("tab", { name: "Rendement · %" }).click();
    assert.equal(await page.locator("[data-slot=chart]").count(), 1);
    check(
      "real observations line, native currency/source/date tooltip, return tab",
    );
    await page
      .locator("summary")
      .filter({ hasText: "Traçabilité et rapport original" })
      .click();
    assert.ok(
      await page
        .getByRole("heading", { name: "Rapport original figé" })
        .isVisible(),
    );
    check("frozen thesis, sources and original report");
    await page.getByRole("tab", { name: "Prix · " + active.currency }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await width("detail mobile");
    await page.locator(".evolution-chart").scrollIntoViewIfNeeded();
    await page
      .locator(".recharts-line-dots circle")
      .first()
      .tap({ force: true });
    await page.locator(".chart-tooltip-provenance").waitFor();
    assert.ok(
      await page.locator(".observation-tooltip").evaluate((e) => {
        const r = e.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth;
      }),
      "mobile tooltip fully visible",
    );
    await width("detail mobile tooltip open");
    await shot("react-detail-mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const excluded = signals.items.find(
      (s) => s.tracking_status === "quarantined",
    );
    if (excluded) {
      await go("/dashboard/signaux/" + excluded.id);
      assert.equal(await page.locator("[data-slot=chart]").count(), 0);
      assert.match(
        await page.locator(".exclusion-notice").innerText(),
        /Performance exclue/,
      );
      await page
        .locator("summary")
        .filter({ hasText: "Historique non exploitable" })
        .click();
      assert.ok(
        await page
          .getByText(
            "Historique non exploitable · conservé pour audit, exclu des performances",
            { exact: true },
          )
          .isVisible(),
      );
      check("quarantined detail has no chart; raw audit remains accessible");
    }
    await go("/dashboard/bilan");
    assert.ok(
      await page
        .getByRole("heading", { name: "Comparer, sans extrapoler" })
        .isVisible(),
    );
    await shot("react-bilan-empty-desktop");
    await choose("cohort-checkpoint", "J5");
    const analytics = await (
      await context.request.get(base + "/api/v1/radar/analytics")
    ).json();
    if (!Object.values(analytics.by_tag).some((g) => g.checkpoints[5].n)) {
      assert.equal(await page.locator("[data-slot=chart]").count(), 0);
      assert.ok(
        await page
          .getByRole("heading", { name: "Échantillon insuffisant à J5" })
          .isVisible(),
      );
    } else {
      const eligibleCohorts = Object.values(analytics.by_tag).filter(
        (g) => g.checkpoints[5].n > 0,
      );
      const bars = page.locator(".recharts-bar-rectangle path");
      assert.equal(await bars.count(), eligibleCohorts.length);
      await bars.first().hover({ force: true });
      await page
        .locator(".recharts-tooltip-wrapper")
        .filter({ hasText: "Médiane" })
        .waitFor();
      assert.match(
        await page.locator(".recharts-tooltip-wrapper").innerText(),
        new RegExp("n=" + eligibleCohorts[0].checkpoints[5].n),
      );
      await page.locator(".cohort-chart").scrollIntoViewIfNeeded();
      await shot("react-cohort-bars-desktop");
      check("actual cohort bars and n/median tooltip");
    }
    await page
      .locator("summary")
      .filter({ hasText: "Mesures détaillées par qualification" })
      .click();
    assert.ok(
      await page
        .getByText(
          "Cibles · cohorte mature J30 uniquement, dénominateur explicite",
          { exact: true },
        )
        .first()
        .isVisible(),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await shot("react-bilan-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await width("bilan mobile");
    await page.evaluate(() => scrollTo(0, 0));
    await shot("react-bilan-mobile");
    check(
      "Bilan actual cohort n, empty graph, native currencies and target denominators",
    );
    await go("/dashboard/methode");
    assert.ok(
      await page
        .getByRole("heading", { name: "Méthode", exact: true })
        .isVisible(),
    );
    await page.locator("#runs summary").first().click();
    assert.ok((await page.locator("#runs pre").first().innerText()).length > 0);
    await width("method mobile");
    await shot("react-method-mobile");
    check("method and original run archive");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(65000); // Respect the existing read rate-limit window.
    for (const status of [401, 400, 429, 500]) {
      let intercept = true;
      await page.route("**/api/v1/radar/signals?**", async (route) =>
        intercept
          ? route.fulfill({
              status,
              contentType: "application/json",
              body: JSON.stringify({ error: "local injected failure" }),
            })
          : route.continue(),
      );
      await go();
      await page.getByRole("alert").waitFor();
      assert.equal(await page.locator("#rows [data-signal]").count(), 0);
      intercept = false;
      await page.getByRole("button", { name: "Réessayer" }).click();
      await wait();
      assert.equal(
        await page.locator("#rows [data-signal]").count(),
        Math.min(signals.total, 50),
      );
      await page.unroute("**/api/v1/radar/signals?**");
    }
    check("401/400/429/500 regional error and real retry");
    await page.route("**/api/v1/radar/signals?**", async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("search") === "slow"
      ) {
        await new Promise((r) => setTimeout(r, 900));
        try {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ total: 0, items: [] }),
          });
        } catch {}
      } else await route.continue();
    });
    await page.getByLabel("Rechercher une société ou un ticker").fill("slow");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await page.getByLabel("Rechercher une société ou un ticker").fill("nvda");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await wait();
    await page.waitForTimeout(1100);
    assert.equal(
      await page.locator("#rows [data-signal]").count(),
      signals.items.filter((s) => s.ticker === "NVDA").length,
    );
    check("aborted stale response cannot overwrite new search");
    assert.deepEqual(report.errors, []);
    check("no pageerror or CSP refusal");
    await context.close();
  } finally {
    fs.writeFileSync(
      out + "/react-browser.json",
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
