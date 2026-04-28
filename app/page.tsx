"use client";

import { useState } from "react";
import { CsvUpload } from "@/components/csv-upload";
import { QueryBox } from "@/components/query-box";
import { ExampleChips } from "@/components/example-chips";
import { ResultPanel } from "@/components/result-panel";
import { runQuery, type DatasetSchema, type QueryResult } from "@/lib/duckdb";

type AskState = {
  loading: boolean;
  result?: QueryResult;
  sql?: string;
  rationale?: string;
  error?: string;
};

export default function Home() {
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [ask, setAsk] = useState<AskState>({ loading: false });
  const [uploadError, setUploadError] = useState<string>("");

  async function handleAsk(question: string) {
    if (!schema) return;
    setAsk({ loading: true });
    try {
      const sqlRes = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          tableName: schema.tableName,
          columns: schema.columns,
          sampleRows: schema.sampleRows,
        }),
      });
      const sqlBody = await sqlRes.json();
      if (!sqlRes.ok) throw new Error(sqlBody.error || "AI request failed");

      const result = await runQuery(sqlBody.sql);
      setAsk({
        loading: false,
        result,
        sql: sqlBody.sql,
        rationale: sqlBody.rationale,
      });
    } catch (err) {
      setAsk({
        loading: false,
        error: err instanceof Error ? err.message : "Query failed",
      });
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Shipment Insights
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Upload a CSV. Ask questions in plain English. Get charts and tables.
          </p>
        </header>

        {!schema && (
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <CsvUpload
              onLoaded={(s, name) => {
                setSchema(s);
                setFileName(name);
                setUploadError("");
              }}
              onError={setUploadError}
            />
            {uploadError && (
              <p className="text-sm text-red-600 mt-3">{uploadError}</p>
            )}
          </section>
        )}

        {schema && (
          <div className="space-y-6">
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-gray-500">
                    {schema.rowCount} rows · {schema.columns.length} columns
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSchema(null);
                    setAsk({ loading: false });
                    setFileName("");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Upload different file
                </button>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                  View schema
                </summary>
                <ul className="mt-2 grid grid-cols-2 gap-1">
                  {schema.columns.map((c) => (
                    <li key={c.name} className="text-gray-700 dark:text-gray-300">
                      <span className="font-mono">{c.name}</span>
                      <span className="text-gray-500"> · {c.type}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>

            <section className="space-y-3">
              <QueryBox onAsk={handleAsk} loading={ask.loading} />
              <ExampleChips onPick={handleAsk} disabled={ask.loading} />
            </section>

            {ask.error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-lg p-4 text-sm">
                {ask.error}
              </div>
            )}

            {ask.result && (
              <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <ResultPanel
                  result={ask.result}
                  sql={ask.sql}
                  rationale={ask.rationale}
                />
              </section>
            )}
          </div>
        )}

        <footer className="mt-16 text-xs text-gray-500 text-center">
          Built with Next.js · DuckDB-WASM · Gemini · Recharts
        </footer>
      </div>
    </main>
  );
}
