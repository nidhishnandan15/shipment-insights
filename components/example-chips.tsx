"use client";

const EXAMPLES = [
  "Which routes had the most delays last month?",
  "Top 5 carriers by on-time delivery rate",
  "How many shipments per destination city?",
];

type Props = {
  onPick: (q: string) => void;
  disabled: boolean;
};

export function ExampleChips({ onPick, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs text-gray-500 self-center mr-1">Try:</span>
      {EXAMPLES.map((q) => (
        <button
          key={q}
          onClick={() => onPick(q)}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
