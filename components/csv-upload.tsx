"use client";

import { useRef, useState } from "react";
import { loadCsvFromFile, loadCsvFromUrl, type DatasetSchema } from "@/lib/duckdb";

type Props = {
  onLoaded: (schema: DatasetSchema, fileName: string) => void;
  onError: (message: string) => void;
};

export function CsvUpload({ onLoaded, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const schema = await loadCsvFromFile(file);
      onLoaded(schema, file.name);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load CSV");
    } finally {
      setLoading(false);
    }
  }

  async function loadSample() {
    setLoading(true);
    try {
      const schema = await loadCsvFromUrl("/sample-shipments.csv");
      onLoaded(schema, "sample-shipments.csv");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load sample");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
            : "border-gray-300 dark:border-gray-700 hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {loading ? (
          <p className="text-sm text-gray-500">Loading CSV…</p>
        ) : (
          <>
            <p className="font-medium">Drag a CSV here or click to browse</p>
            <p className="text-xs text-gray-500 mt-1">
              Shipment data — origin, destination, carrier, dates, status, etc.
            </p>
          </>
        )}
      </div>
      <div className="text-center">
        <button
          onClick={loadSample}
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-700 underline disabled:opacity-50"
        >
          Or try the sample dataset →
        </button>
      </div>
    </div>
  );
}
