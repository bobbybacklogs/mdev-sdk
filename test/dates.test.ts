import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareDates, normalizeDate, sortDates } from "../src/dates.js";

describe("normalizeDate", () => {
  it("expands YYYY-MM to the first of the month", () => {
    assert.equal(normalizeDate("2024-05"), "2024-05-01");
  });

  it("leaves YYYY-MM-DD unchanged", () => {
    assert.equal(normalizeDate("2024-05-14"), "2024-05-14");
  });

  it("leaves anything else unchanged", () => {
    assert.equal(normalizeDate("2024"), "2024");
  });
});

describe("compareDates", () => {
  it("treats YYYY-MM as the 1st of that month", () => {
    assert.ok(compareDates("2024-05", "2024-04-30") > 0);
    assert.equal(compareDates("2024-05-01", "2024-05"), 0);
    assert.ok(compareDates("2024-01", "2024-02") < 0);
  });
});

describe("sortDates", () => {
  it("sorts mixed formats ascending and descending", () => {
    assert.deepEqual(sortDates(["2024-02", "2024-01-15", "2024-01"]), ["2024-01", "2024-01-15", "2024-02"]);
    assert.deepEqual(sortDates(["2024-02", "2024-01-15", "2024-01"], "desc"), ["2024-02", "2024-01-15", "2024-01"]);
  });
});
