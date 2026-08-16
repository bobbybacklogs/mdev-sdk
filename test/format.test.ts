import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  color,
  colorEnabled,
  costCell,
  renderTable,
  setColorEnabled,
  statusBadge,
  stripAnsi,
  truncate,
  visibleLength,
  wrapText,
  type TableColumn,
} from "../src/format.js";

after(() => {
  setColorEnabled(undefined);
});

describe("color", () => {
  it("returns plain text when color is disabled", () => {
    setColorEnabled(false);
    assert.equal(color("hi", "red"), "hi");
    assert.equal(color("hi", "bold", "cyan"), "hi");
    assert.equal(colorEnabled(), false);
  });

  it("wraps text in ANSI codes when enabled", () => {
    setColorEnabled(true);
    assert.equal(color("hi", "red"), "\x1b[31mhi\x1b[0m");
    assert.equal(color("hi", "bold", "cyan"), "\x1b[1;36mhi\x1b[0m");
    assert.equal(color("hi", "gray"), "\x1b[90mhi\x1b[0m");
    assert.equal(color("hi", "dim"), "\x1b[2mhi\x1b[0m");
    assert.equal(color("hi"), "hi");
  });

  it("stripAnsi and visibleLength ignore escape codes", () => {
    setColorEnabled(true);
    const styled = color("model", "red");
    assert.equal(stripAnsi(styled), "model");
    assert.equal(visibleLength(styled), 5);
    assert.equal(visibleLength("plain"), 5);
  });

  it("setColorEnabled(undefined) restores auto-detect without throwing", () => {
    setColorEnabled(true);
    assert.equal(colorEnabled(), true);
    setColorEnabled(undefined);
    assert.doesNotThrow(() => colorEnabled());
    setColorEnabled(false);
  });
});

describe("statusBadge", () => {
  it("maps statuses to badge text and colors", () => {
    assert.deepEqual(statusBadge(undefined), { text: "GA", color: ["green"] });
    assert.deepEqual(statusBadge("ga"), { text: "GA", color: ["green"] });
    assert.deepEqual(statusBadge("alpha"), { text: "alpha", color: ["cyan"] });
    assert.deepEqual(statusBadge("beta"), { text: "beta", color: ["yellow"] });
    assert.deepEqual(statusBadge("deprecated"), { text: "deprecated", color: ["red"] });
    assert.deepEqual(statusBadge("experimental"), { text: "experimental", color: undefined });
  });
});

describe("costCell", () => {
  it("renders missing, zero, and positive costs", () => {
    assert.deepEqual(costCell(undefined), { text: "—", color: ["gray"] });
    assert.deepEqual(costCell(Number.NaN), { text: "—", color: ["gray"] });
    assert.deepEqual(costCell(undefined, true), { text: "-", color: ["gray"] });
    assert.deepEqual(costCell(0), { text: "$0.00", color: ["green"] });
    assert.deepEqual(costCell(5), { text: "$5.00", color: undefined });
    assert.deepEqual(costCell(0.0003), { text: "$0.0003", color: undefined });
  });
});

describe("truncate", () => {
  it("uses a unicode ellipsis by default and ASCII in ascii mode", () => {
    assert.equal(truncate("short", 10), "short");
    assert.equal(truncate("abcdefghijklmnop", 10), "abcdefghi…");
    assert.equal(truncate("abcdefghijklmnop", 10, true), "abcdefg...");
    assert.equal(truncate("abcdefghijklmnop", 4, true), "a...");
    assert.equal(truncate("abcdefghijklmnop", 1), "…");
  });

  it("never exceeds the max visible length", () => {
    for (const max of [1, 2, 3, 4, 5, 8, 10]) {
      const unicode = truncate("hello world, this string is quite long", max, false);
      const ascii = truncate("hello world, this string is quite long", max, true);
      assert.ok(visibleLength(unicode) <= max, `unicode max=${max}: ${JSON.stringify(unicode)}`);
      assert.ok(visibleLength(ascii) <= max, `ascii max=${max}: ${JSON.stringify(ascii)}`);
    }
    assert.equal(truncate("anything", 0), "");
  });
});

describe("wrapText", () => {
  it("wraps on word boundaries", () => {
    const lines = wrapText("the quick brown fox jumps over the lazy dog", 10);
    assert.deepEqual(lines, ["the quick", "brown fox", "jumps over", "the lazy", "dog"]);
    for (const line of lines) assert.ok(visibleLength(line) <= 10);
  });

  it("hard-breaks over-long words", () => {
    const lines = wrapText("supercalifragilisticexpialidocious end", 8);
    assert.deepEqual(lines, ["supercal", "ifragili", "sticexpi", "alidocio", "us", "end"]);
    for (const line of lines) assert.ok(visibleLength(line) <= 8);
  });

  it("handles empty input", () => {
    assert.deepEqual(wrapText("", 10), []);
    assert.deepEqual(wrapText("text", 0), []);
  });
});

describe("renderTable", () => {
  it("renders a known table exactly with color disabled", () => {
    setColorEnabled(false);
    const columns: TableColumn[] = [
      { header: "ID" },
      { header: "Count", align: "right" },
    ];
    const rows = [
      [{ text: "openai" }, { text: "3" }],
      [{ text: "anthropic" }, { text: "42" }],
    ];
    const out = renderTable(columns, rows, { maxWidth: 120 });
    assert.equal(
      out,
      [
        "┌───────────┬───────┐",
        "│ ID        │ Count │",
        "├───────────┼───────┤",
        "│ openai    │     3 │",
        "│ anthropic │    42 │",
        "└───────────┴───────┘",
        "",
      ].join("\n"),
    );
  });

  it("uses only + - | characters in ascii mode", () => {
    setColorEnabled(false);
    const out = renderTable(
      [
        { header: "ID" },
        { header: "N", align: "right" },
      ],
      [[{ text: "a" }, { text: "1" }]],
      { maxWidth: 80, ascii: true },
    );
    assert.equal(out, "+----+---+\n| ID | N |\n+----+---+\n| a  | 1 |\n+----+---+\n");
    assert.ok(!/[\u2500-\u257f]/.test(out), "no box-drawing characters");
  });

  it("truncates overlong cells with an ellipsis", () => {
    setColorEnabled(false);
    const long = "A very long model name that exceeds the default max column width";
    const out = renderTable([{ header: "Name" }], [[{ text: long }]], { maxWidth: 60 });
    assert.ok(out.includes("…"));
    assert.ok(!out.includes(long));
    for (const line of out.trimEnd().split("\n")) {
      assert.ok(visibleLength(line) <= 60, line);
    }
  });

  it("respects the per-column max", () => {
    setColorEnabled(false);
    const out = renderTable(
      [
        { header: "H" },
        { header: "L", max: 6 },
      ],
      [[{ text: "abcdefghij" }, { text: "abcdefghij" }]],
      { maxWidth: 200 },
    );
    // Second column capped at 6 visible chars: 5 + ellipsis.
    assert.ok(out.includes("abcde…"));
  });

  it("shrinks the widest columns to fit maxWidth", () => {
    setColorEnabled(false);
    const columns: TableColumn[] = [{ header: "Model" }, { header: "Name" }, { header: "Context" }];
    const rows = [[{ text: "anthropic/claude-opus-4-6" }, { text: "Claude Opus 4.6" }, { text: "200,000" }]];
    const natural = renderTable(columns, rows, { maxWidth: 200 });
    assert.ok(visibleLength(natural.trimEnd().split("\n")[0]!) > 40);
    const out = renderTable(columns, rows, { maxWidth: 40 });
    for (const line of out.trimEnd().split("\n")) {
      assert.ok(visibleLength(line) <= 40, JSON.stringify(line));
    }
    assert.ok(out.includes("…"));
  });

  it("renders colored cells without breaking widths", () => {
    setColorEnabled(true);
    const out = renderTable(
      [{ header: "Name" }, { header: "Cost", align: "right" }],
      [[{ text: "model", color: ["cyan"] }, costCell(5)]],
      { maxWidth: 80 },
    );
    for (const line of out.trimEnd().split("\n")) {
      assert.equal(visibleLength(line), 17, JSON.stringify(line));
    }
    assert.ok(out.includes("\x1b[36m"));
    setColorEnabled(false);
  });
});
