import { NextResponse } from "next/server";
import { generateSql } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, tableName, columns, sampleRows } = body ?? {};

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: "Missing schema" }, { status: 400 });
    }

    const result = await generateSql({
      question: question.trim(),
      tableName: tableName || "shipments",
      columns,
      sampleRows: Array.isArray(sampleRows) ? sampleRows : [],
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
