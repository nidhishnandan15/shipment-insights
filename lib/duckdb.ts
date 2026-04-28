"use client";

import * as duckdb from "@duckdb/duckdb-wasm";

export type ColumnSchema = {
  name: string;
  type: string;
};

export type DatasetSchema = {
  tableName: string;
  columns: ColumnSchema[];
  sampleRows: Record<string, unknown>[];
  rowCount: number;
};

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function initDb(): Promise<duckdb.AsyncDuckDB> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);

    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], {
        type: "text/javascript",
      })
    );

    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);
    return db;
  })();

  return dbPromise;
}

export async function loadCsvFromFile(
  file: File,
  tableName = "shipments"
): Promise<DatasetSchema> {
  const db = await initDb();
  const buffer = new Uint8Array(await file.arrayBuffer());
  await db.registerFileBuffer(file.name, buffer);

  const conn = await db.connect();
  try {
    await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
    await conn.query(
      `CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${file.name}', HEADER=TRUE, SAMPLE_SIZE=-1)`
    );
    return await collectSchema(conn, tableName);
  } finally {
    await conn.close();
  }
}

export async function loadCsvFromUrl(
  url: string,
  tableName = "shipments"
): Promise<DatasetSchema> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const text = await res.text();
  const fileName = url.split("/").pop() || "data.csv";
  const file = new File([text], fileName, { type: "text/csv" });
  return loadCsvFromFile(file, tableName);
}

async function collectSchema(
  conn: duckdb.AsyncDuckDBConnection,
  tableName: string
): Promise<DatasetSchema> {
  const describeResult = await conn.query(`DESCRIBE ${tableName}`);
  const columns: ColumnSchema[] = describeResult.toArray().map((row) => {
    const obj = row.toJSON() as { column_name: string; column_type: string };
    return { name: obj.column_name, type: obj.column_type };
  });

  const sampleResult = await conn.query(`SELECT * FROM ${tableName} LIMIT 5`);
  const sampleRows = sampleResult
    .toArray()
    .map((row) => normalizeRow(row.toJSON() as Record<string, unknown>));

  const countResult = await conn.query(
    `SELECT COUNT(*) AS n FROM ${tableName}`
  );
  const countRow = countResult.toArray()[0]?.toJSON() as
    | { n: bigint | number }
    | undefined;
  const rowCount = countRow ? Number(countRow.n) : 0;

  return { tableName, columns, sampleRows, rowCount };
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const db = await initDb();
  const conn = await db.connect();
  try {
    const result = await conn.query(sql);
    const columns = result.schema.fields.map((f) => f.name);
    const rows = result
      .toArray()
      .map((row) => normalizeRow(row.toJSON() as Record<string, unknown>));
    return { columns, rows };
  } finally {
    await conn.close();
  }
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "bigint") out[k] = Number(v);
    else if (v instanceof Date) out[k] = v.toISOString().slice(0, 10);
    else out[k] = v;
  }
  return out;
}
