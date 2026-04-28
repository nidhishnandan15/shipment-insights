"use client";

import { useState } from "react";

type Props = {
  onAsk: (question: string) => void;
  loading: boolean;
};

export function QueryBox({ onAsk, loading }: Props) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onAsk(trimmed);
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Ask anything about your shipments…"
        disabled={loading}
        className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      />
      <button
        onClick={submit}
        disabled={loading || !text.trim()}
        className="px-5 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Thinking…" : "Ask"}
      </button>
    </div>
  );
}
