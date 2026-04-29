import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ColumnSchema } from "./duckdb";

export type SqlGenerationInput = {
  question: string;
  tableName: string;
  columns: ColumnSchema[];
  sampleRows: Record<string, unknown>[];
};

export type SqlGenerationResult = {
  sql: string;
  rationale: string;
  source: "llm" | "pattern";
};

const SYSTEM_PROMPT = `You translate a manager's plain-English question about a shipment dataset into a single DuckDB SQL query.

Rules:
- Output ONLY a JSON object: {"sql": "...", "rationale": "one sentence explaining the query"}.
- The SQL MUST be a single SELECT statement. No DDL, no DML, no semicolons inside, no comments.
- Use the exact table name and column names provided in the schema.
- Prefer aggregations and ORDER BY when the question is about ranking, totals, trends, or comparisons.
- For "last month" or "last 30 days" questions, use date arithmetic on the relevant date column. Today's date is CURRENT_DATE.
- LIMIT results to 50 rows max unless the question explicitly asks for more.
- If the question is ambiguous, make the most reasonable interpretation a logistics manager would expect.`;

export async function generateSql(
  input: SqlGenerationInput
): Promise<SqlGenerationResult> {
  const llm = await tryLLM(input);
  if (llm) return llm;

  const pattern = tryPatterns(input);
  if (pattern) return pattern;

  throw new Error(
    "Could not interpret that question. Try one of the example chips, or rephrase around delays, carriers, on-time rates, destinations, origins, weight, or status."
  );
}

async function tryLLM(
  input: SqlGenerationInput
): Promise<SqlGenerationResult | null> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const userPrompt = buildUserPrompt(input);
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Understood. I will return JSON only." }] },
        { role: "user", parts: [{ text: userPrompt }] },
      ],
    });

    const text = result.response.text();
    const parsed = parseSqlResponse(text);
    return { ...parsed, source: "llm" };
  } catch {
    return null;
  }
}

function buildUserPrompt(input: SqlGenerationInput): string {
  const schemaLines = input.columns
    .map((c) => `  - ${c.name} (${c.type})`)
    .join("\n");

  const sampleLines = input.sampleRows
    .slice(0, 3)
    .map((r) => "  " + JSON.stringify(r))
    .join("\n");

  return `Table: ${input.tableName}
Schema:
${schemaLines}

Sample rows:
${sampleLines}

Question: ${input.question}

Return JSON: {"sql": "...", "rationale": "..."}`;
}

function parseSqlResponse(text: string): { sql: string; rationale: string } {
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleaned) as { sql?: string; rationale?: string };
  if (!parsed.sql) throw new Error("LLM did not return SQL");

  const sql = parsed.sql.replace(/;+\s*$/, "").trim();
  if (!/^\s*select|^\s*with/i.test(sql)) {
    throw new Error("LLM produced non-SELECT SQL");
  }
  return { sql, rationale: parsed.rationale || "" };
}

type Pattern = {
  match: (q: string) => boolean;
  build: (table: string) => { sql: string; rationale: string };
};

const PATTERNS: Pattern[] = [
  {
    match: (q) =>
      /(delay|delayed|late)/.test(q) &&
      /(route|routes)/.test(q) &&
      /(month|30 ?days?|last)/.test(q),
    build: (t) => ({
      sql: `SELECT route_id,
       COUNT(*) AS shipments,
       SUM(delay_days) AS total_delay_days,
       ROUND(AVG(delay_days), 1) AS avg_delay_days
FROM ${t}
WHERE ship_date >= CURRENT_DATE - INTERVAL 30 DAY
  AND status = 'Delayed'
GROUP BY route_id
ORDER BY total_delay_days DESC
LIMIT 10`,
      rationale:
        "Routes ranked by total delay days for delayed shipments in the last 30 days.",
    }),
  },
  {
    match: (q) =>
      /(carrier|carriers)/.test(q) && /(on[- ]?time|reliab|best|top)/.test(q),
    build: (t) => ({
      sql: `SELECT carrier,
       COUNT(*) AS total_shipments,
       SUM(CASE WHEN status = 'Delivered' AND delay_days = 0 THEN 1 ELSE 0 END) AS on_time,
       ROUND(
         100.0 * SUM(CASE WHEN status = 'Delivered' AND delay_days = 0 THEN 1 ELSE 0 END) / COUNT(*),
         1
       ) AS on_time_rate_pct
FROM ${t}
GROUP BY carrier
ORDER BY on_time_rate_pct DESC
LIMIT 5`,
      rationale: "Carriers ranked by on-time delivery rate (delivered with zero delay days).",
    }),
  },
  {
    match: (q) =>
      /(destination|cities|city)/.test(q) &&
      /(count|how many|shipments|volume|per)/.test(q),
    build: (t) => ({
      sql: `SELECT destination_city,
       COUNT(*) AS shipment_count
FROM ${t}
GROUP BY destination_city
ORDER BY shipment_count DESC
LIMIT 10`,
      rationale: "Shipment volume per destination city.",
    }),
  },
  {
    match: (q) => /(carrier)/.test(q) && /(delay|average|avg)/.test(q),
    build: (t) => ({
      sql: `SELECT carrier,
       ROUND(AVG(delay_days), 2) AS avg_delay_days,
       COUNT(*) AS shipments
FROM ${t}
GROUP BY carrier
ORDER BY avg_delay_days DESC`,
      rationale: "Average delay days per carrier.",
    }),
  },
  {
    match: (q) => /(status)/.test(q) && /(count|breakdown|distribution|how many)/.test(q),
    build: (t) => ({
      sql: `SELECT status,
       COUNT(*) AS shipments
FROM ${t}
GROUP BY status
ORDER BY shipments DESC`,
      rationale: "Shipment count by status.",
    }),
  },
  {
    match: (q) => /(origin)/.test(q) && /(count|how many|shipments|volume|per)/.test(q),
    build: (t) => ({
      sql: `SELECT origin_city,
       COUNT(*) AS shipment_count
FROM ${t}
GROUP BY origin_city
ORDER BY shipment_count DESC
LIMIT 10`,
      rationale: "Shipment volume per origin city.",
    }),
  },
  {
    match: (q) => /(weight|kg|heaviest|largest)/.test(q),
    build: (t) => ({
      sql: `SELECT carrier,
       ROUND(AVG(weight_kg), 1) AS avg_weight_kg,
       ROUND(SUM(weight_kg), 1) AS total_weight_kg,
       COUNT(*) AS shipments
FROM ${t}
GROUP BY carrier
ORDER BY total_weight_kg DESC`,
      rationale: "Weight totals and averages per carrier.",
    }),
  },
];

function tryPatterns(input: SqlGenerationInput): SqlGenerationResult | null {
  const q = input.question.toLowerCase();
  const table = input.tableName || "shipments";
  for (const p of PATTERNS) {
    if (p.match(q)) {
      const built = p.build(table);
      return { ...built, source: "pattern" };
    }
  }
  return null;
}
