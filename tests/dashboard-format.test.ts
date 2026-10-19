import { test } from "node:test";
import assert from "node:assert/strict";
import {
  numeric,
  percent,
  price,
  tracking,
  measure,
  safeURL,
} from "../src/dashboard/format.js";
test("financial formatting preserves absent, zero, numeric strings and tiny values", () => {
  assert.equal(numeric(null), null);
  assert.equal(numeric(""), null);
  assert.equal(numeric("x"), null);
  assert.equal(numeric("1.25"), 1.25);
  assert.equal(percent(null), "Non mesurable");
  assert.match(percent(0), /^0,00/);
  assert.match(percent("1.25"), /^\+1,25/);
  assert.match(percent(0.00001), /0,00001/);
  assert.match(price("12.30", "EUR"), /12,30.*EUR/);
  assert.equal(tracking("new-status"), "État non renseigné");
});
test("quarantined and missing measures never appear as validated returns", () => {
  const row = {
    tracking_status: "quarantined",
    performance: {
      current_return_pct: 99,
      checkpoints: { 5: 99 },
      sessions: 1,
    },
  };
  assert.equal(
    measure({ ...row, tracking_status: "active", measurement_eligible: false }),
    "Exclu · politique de mesure",
  );
  assert.equal(measure(row), "Exclu · quarantaine");
  assert.equal(measure(row, 5), "Exclu · quarantaine");
  assert.equal(
    measure({ ...row, tracking_status: "missing" }),
    "Exclu · données manquantes",
  );
  assert.equal(
    measure(
      {
        ...row,
        tracking_status: "active",
        performance: { sessions: 1, checkpoints: { 5: null } },
      },
      5,
    ),
    "Non atteint",
  );
  assert.equal(
    measure(
      {
        ...row,
        tracking_status: "active",
        performance: {
          sessions: 1,
          data_status: "gap",
          checkpoints: { 5: null },
        },
      },
      5,
    ),
    "Non mesurable · lacune",
  );
  assert.equal(safeURL("javascript:alert(1)"), null);
  assert.equal(
    measure({
      ...row,
      tracking_status: "active",
      payload: { assessment_status: "unknown" },
    }),
    "Exclu · non évalué",
  );
  assert.equal(safeURL("https://example.com/a"), "https://example.com/a");
});
