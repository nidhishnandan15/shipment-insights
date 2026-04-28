"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QueryResult } from "@/lib/duckdb";
import { pickChart } from "@/lib/chart-picker";

type Props = {
  result: QueryResult;
  sql?: string;
  rationale?: string;
};

const COLORS = ["#2563eb", "#16a34a", "#dc2626"];

export function ResultPanel({ result, sql, rationale }: Props) {
  const choice = pickChart(result);

  return (
    <div className="space-y-4">
      {rationale && (
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
          {rationale}
        </p>
      )}

      {choice.kind === "bar" && (
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <BarChart data={result.rows} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey={choice.categoryKey}
                tick={{ fontSize: 12 }}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {choice.valueKeys.map((k, i) => (
                <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {choice.kind === "line" && (
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <LineChart data={result.rows} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={choice.timeKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {choice.valueKeys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <ResultTable result={result} />

      {sql && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            View generated SQL
          </summary>
          <pre className="mt-2 p-3 rounded bg-gray-100 dark:bg-gray-900 overflow-x-auto">
            {sql}
          </pre>
        </details>
      )}
    </div>
  );
}

function ResultTable({ result }: { result: QueryResult }) {
  if (result.rows.length === 0) {
    return <p className="text-sm text-gray-500">No rows returned.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c}
                className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr
              key={i}
              className="border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              {result.columns.map((c) => (
                <td key={c} className="px-3 py-2 text-gray-800 dark:text-gray-200">
                  {formatCell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  }
  return String(v);
}
