#!/usr/bin/env node
import { parseArgs } from "node:util";
import { ModelsDevClient } from "./client.js";
import {
  color,
  costCell,
  renderTable,
  setColorEnabled,
  statusBadge,
  visibleLength,
  wrapText,
  type TableCell,
  type TableColumn,
} from "./format.js";
import { parseCanonicalId } from "./ids.js";
import { compareInputCost, formatCostUSD } from "./pricing.js";
import { filterModels } from "./query.js";
import { downloadSnapshot } from "./snapshot-script.js";

const DEFAULT_LIMIT = 20;

const HELP = `modelsdev — a CLI for the models.dev API

Usage:
  modelsdev providers [--search <text>] [--limit N] [--json]
  modelsdev search <query> [--min-context N] [--max-input-cost N] [--limit N] [--json]
  modelsdev info <provider/model> [--json]
  modelsdev snapshot
  modelsdev --help

Options:
  --search <text>        only show providers whose id or name contains <text>
  --limit N              maximum number of results to print (default ${DEFAULT_LIMIT})
  --min-context N        minimum context window in tokens
  --max-input-cost N     maximum input price in USD per 1M tokens
  --json                 print raw JSON instead of human-readable output
  --no-color             disable ANSI colors
  --ascii                use ASCII-only decorations (for legacy consoles)
  -h, --help             show this help

Examples:
  modelsdev providers --search anthropic
  modelsdev search claude --min-context 200000 --max-input-cost 5
  modelsdev info anthropic/claude-opus-4-6
`;

interface CliOptions {
  json: boolean;
  ascii: boolean;
  search?: string;
  limit: number;
  minContext?: number;
  maxInputCost?: number;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: "boolean", short: "h" },
      json: { type: "boolean" },
      "no-color": { type: "boolean" },
      ascii: { type: "boolean" },
      search: { type: "string" },
      limit: { type: "string" },
      "min-context": { type: "string" },
      "max-input-cost": { type: "string" },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  const command = (positionals[0] ?? "").toLowerCase();
  if (command === "" || command === "help") {
    process.stdout.write(HELP);
    return;
  }

  const options: CliOptions = {
    json: values.json === true,
    ascii: values.ascii === true,
    search: typeof values.search === "string" ? values.search : undefined,
    limit: parseLimit(values.limit, DEFAULT_LIMIT),
    minContext: parseNumber(values["min-context"]),
    maxInputCost: parseNumber(values["max-input-cost"]),
  };
  setColorEnabled(values["no-color"] === true ? false : undefined);

  switch (command) {
    case "providers":
      await runProviders(options);
      return;
    case "search": {
      const query = positionals[1];
      if (!query) throw new Error("missing search query — usage: modelsdev search <query>");
      await runSearch(query, options);
      return;
    }
    case "info": {
      const id = positionals[1];
      if (!id) throw new Error("missing model id — usage: modelsdev info <provider/model>");
      await runInfo(id, options);
      return;
    }
    case "snapshot": {
      const result = await downloadSnapshot();
      process.stdout.write(
        `Snapshot written to ${color(result.dir, "green")} (${result.files.length} files) at ${color(result.generatedAt, "dim")}\n`,
      );
      return;
    }
    default:
      throw new Error(`unknown command "${command}" — run "modelsdev --help" for usage`);
  }
}

async function runProviders(options: CliOptions): Promise<void> {
  const client = new ModelsDevClient();
  const providers = await client.providers();
  const search = options.search?.toLowerCase();
  const list = Object.values(providers)
    .filter((provider) => {
      if (!search) return true;
      return provider.id.toLowerCase().includes(search) || provider.name.toLowerCase().includes(search);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (options.json) {
    process.stdout.write(`${JSON.stringify(list.slice(0, options.limit), null, 2)}\n`);
    return;
  }
  const columns: TableColumn[] = [
    { header: "ID" },
    { header: "Name" },
    { header: "Models", align: "right" },
    { header: "npm" },
  ];
  const rows: TableCell[][] = list.slice(0, options.limit).map((provider) => [
    { text: provider.id },
    { text: provider.name },
    { text: String(Object.keys(provider.models).length) },
    { text: provider.npm, color: ["gray"] },
  ]);
  process.stdout.write(renderTable(columns, rows, { ascii: options.ascii }));
  writeFooter(list.length, options.limit, options.ascii);
}

async function runSearch(query: string, options: CliOptions): Promise<void> {
  const client = new ModelsDevClient();
  const { providers } = await client.catalog();
  const matches = filterModels(providers, {
    search: query,
    minContext: options.minContext,
    maxInputCost: options.maxInputCost,
  }).sort((a, b) => compareInputCost(a.model, b.model));

  if (options.json) {
    process.stdout.write(`${JSON.stringify(matches.slice(0, options.limit), null, 2)}\n`);
    return;
  }
  const columns: TableColumn[] = [
    { header: "Model" },
    { header: "Name" },
    { header: "Context", align: "right" },
    { header: "In $/1M", align: "right" },
    { header: "Out $/1M", align: "right" },
    { header: "Status" },
  ];
  const rows: TableCell[][] = matches.slice(0, options.limit).map((match) => {
    const badge = statusBadge(match.model.status);
    return [
      { text: `${match.providerId}/${match.model.id}` },
      { text: match.model.name },
      { text: match.model.limit.context.toLocaleString("en-US") },
      costCell(match.model.cost?.input, options.ascii),
      costCell(match.model.cost?.output, options.ascii),
      { text: badge.text, color: badge.color },
    ];
  });
  process.stdout.write(renderTable(columns, rows, { ascii: options.ascii }));
  writeFooter(matches.length, options.limit, options.ascii);
}

async function runInfo(id: string, options: CliOptions): Promise<void> {
  const { provider: providerId, model: modelId } = parseCanonicalId(id);
  const client = new ModelsDevClient();
  const found = await client.model(id);
  if (!found) {
    throw new Error(`model "${id}" not found (provider "${providerId}", model "${modelId}")`);
  }
  const { provider, model } = found;
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ provider, model }, null, 2)}\n`);
    return;
  }

  const ascii = options.ascii;
  const lines: string[] = [];
  lines.push(
    `${color(model.name, "bold")}${ascii ? " - " : " — "}${color(`${providerId}/${model.id}`, "gray")}`,
  );

  const kv: Array<[string, string]> = [];
  kv.push(["provider", provider.name]);
  kv.push(["description", model.description]);
  kv.push(["context", `${model.limit.context.toLocaleString("en-US")} tokens`]);
  kv.push(["input cost", `${fmtCost(model.cost?.input, ascii)} per 1M tokens`]);
  kv.push(["output cost", `${fmtCost(model.cost?.output, ascii)} per 1M tokens`]);
  if (model.cost?.tiers) kv.push(["tiers", `${model.cost.tiers.length} tiers (context-sized)`]);
  kv.push(["reasoning", model.reasoning ? "yes" : "no"]);
  kv.push(["tool calls", model.tool_call ? "yes" : "no"]);
  kv.push(["input", model.modalities.input.join(", ")]);
  kv.push(["output", model.modalities.output.join(", ")]);
  kv.push(["open weights", model.open_weights ? "yes" : "no"]);
  kv.push(["status", badgeText(model.status)]);
  kv.push(["last updated", model.last_updated]);
  kv.push(["knowledge", model.knowledge ?? (ascii ? "-" : "—")]);

  const maxLabelLength = Math.max(...kv.map(([label]) => visibleLength(label)));
  const labelColumn = maxLabelLength + 2;
  const terminalColumns =
    typeof process.stdout.columns === "number" && process.stdout.columns > 0
      ? process.stdout.columns
      : 120;
  const wrapWidth = terminalColumns - labelColumn - 3;
  const offset = 2 + labelColumn;

  for (const [label, value] of kv) {
    const pad = " ".repeat(labelColumn - visibleLength(label));
    if (label === "description") {
      const wrapped = wrapText(value, wrapWidth);
      const descriptionLines = wrapped.length > 0 ? wrapped : [""];
      for (let i = 0; i < descriptionLines.length; i++) {
        lines.push(
          i === 0
            ? `  ${color(label, "cyan")}${pad}${descriptionLines[i]!}`
            : `${" ".repeat(offset)}${descriptionLines[i]!}`,
        );
      }
      continue;
    }
    lines.push(`  ${color(label, "cyan")}${pad}${value}`);
  }

  const badges: string[] = [];
  if (model.reasoning) {
    const effort = model.reasoning_options?.find((option) => option.type === "effort");
    if (effort?.type === "effort" && effort.values.length > 0) {
      badges.push(color(`[reasoning: ${effort.values.join("/")}]`, "yellow", "dim"));
    } else {
      badges.push(color("[reasoning]", "yellow"));
    }
  }
  if (model.tool_call) badges.push(color("[tool-call]", "cyan"));
  if (model.structured_output) badges.push(color("[structured-output]", "magenta"));
  if (model.attachment) badges.push(color("[vision]", "green"));
  if (model.temperature) badges.push(color("[temperature]", "blue"));
  if (model.open_weights) badges.push(color("[open-weights]", "green"));
  if (badges.length > 0) {
    const pad = " ".repeat(labelColumn - visibleLength("capabilities"));
    lines.push(`  ${color("capabilities", "cyan")}${pad}${badges.join(" ")}`);
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function parseNumber(raw: unknown): number | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseLimit(raw: unknown, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`--limit must be a positive integer, got "${String(raw)}"`);
  }
  return value;
}

function writeFooter(total: number, limit: number, ascii: boolean): void {
  if (total <= limit) return;
  const more = total - limit;
  const ellipsis = ascii ? "..." : "…";
  process.stdout.write(
    `${color(`${ellipsis} and ${more} more (use --limit ${more} to show more)`, "dim")}\n`,
  );
}

/** Format a per-1M cost, with an ASCII dash for missing prices. */
function fmtCost(value: number | undefined, ascii: boolean): string {
  const text = formatCostUSD(value ?? Number.NaN);
  return ascii && text === "—" ? "-" : text;
}

/** Render a status badge with its color, or plain when uncolored. */
function badgeText(status: string | undefined): string {
  const badge = statusBadge(status);
  return badge.color ? color(badge.text, ...badge.color) : badge.text;
}

main().catch((error: unknown) => {
  process.stderr.write(`modelsdev: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
