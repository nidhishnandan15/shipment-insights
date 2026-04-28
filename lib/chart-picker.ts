import type { QueryResult } from "./duckdb";

export type ChartChoice =
  | { kind: "table" }
  | {
      kind: "bar";
      categoryKey: string;
      valueKeys: string[];
    }
  | {
      kind: "line";
      timeKey: string;
      valueKeys: string[];
    };

export function pickChart(result: QueryResult): ChartChoice {
  const { columns, rows } = result;
  if (rows.length === 0 || columns.length < 2) return { kind: "table" };
  if (rows.length > 30) return { kind: "table" };

  const numericKeys = columns.filter((c) => isNumericColumn(rows, c));
  const dateKey = columns.find((c) => isDateColumn(rows, c));
  const categoryKey = columns.find(
    (c) => !numericKeys.includes(c) && c !== dateKey
  );

  if (dateKey && numericKeys.length >= 1) {
    return { kind: "line", timeKey: dateKey, valueKeys: numericKeys.slice(0, 3) };
  }

  if (categoryKey && numericKeys.length >= 1) {
    return {
      kind: "bar",
      categoryKey,
      valueKeys: numericKeys.slice(0, 3),
    };
  }

  return { kind: "table" };
}

function isNumericColumn(rows: Record<string, unknown>[], key: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined) continue;
    seen++;
    if (typeof v !== "number" && !(typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v))) {
      return false;
    }
  }
  return seen > 0;
}

function isDateColumn(rows: Record<string, unknown>[], key: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined) continue;
    seen++;
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return false;
  }
  return seen > 0;
}
