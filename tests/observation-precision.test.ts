import { test } from "node:test";
import assert from "node:assert/strict";
import { centPrecisionEquivalent } from "../src/market.js";
import { Bar } from "../src/core.js";
const bar = (overrides: Partial<Bar> = {}): Bar => ({
  session: "2026-10-05",
  n: 1,
  open: 236.08999633789062,
  high: 240.09829711914062,
  low: 235.14999389648438,
  close: 238.89999389648438,
  adjustment_factor: 1,
  ...overrides,
});
test("recorded Yahoo cent-normalization differences preserve frozen values", () => {
  assert.equal(
    centPrecisionEquivalent(bar(), bar({ high: 240.10000610351562 }), "USD"),
    true,
  );
  assert.equal(
    centPrecisionEquivalent(
      bar({ low: 161.39320373535156 }),
      bar({ low: 161.38999938964844 }),
      "USD",
    ),
    true,
  );
  assert.equal(
    centPrecisionEquivalent(
      bar({ high: 192.6898956298828 }),
      bar({ high: 192.69000244140625 }),
      "USD",
    ),
    true,
  );
});
test("material or ambiguous subcent changes are not a precision exemption", () => {
  assert.equal(
    centPrecisionEquivalent(bar(), bar({ open: 236.07000732421875 }), "USD"),
    false,
  );
  assert.equal(
    centPrecisionEquivalent(
      bar({ high: 363.864990234375 }),
      bar({ high: 363.8699951171875 }),
      "USD",
    ),
    false,
  );
  assert.equal(
    centPrecisionEquivalent(
      bar({ high: 240.098 }),
      bar({ high: 240.099 }),
      "USD",
    ),
    false,
  );
  assert.equal(
    centPrecisionEquivalent(bar(), bar({ close: 238.9, high: 240.12 }), "USD"),
    false,
  );
});
test("identity, split factor and unsupported currencies fail closed", () => {
  assert.equal(centPrecisionEquivalent(bar(), bar({ n: 2 }), "USD"), false);
  assert.equal(
    centPrecisionEquivalent(bar(), bar({ session: "2026-10-06" }), "USD"),
    false,
  );
  assert.equal(
    centPrecisionEquivalent(bar(), bar({ adjustment_factor: 2 }), "USD"),
    false,
  );
  assert.equal(
    centPrecisionEquivalent(bar(), bar({ high: 240.1 }), "JPY"),
    false,
  );
  assert.equal(
    centPrecisionEquivalent(bar(), bar({ high: NaN }), "USD"),
    false,
  );
});
