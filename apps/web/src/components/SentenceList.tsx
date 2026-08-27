import type { Sentence } from "@/lib/types";

export function SentenceList({
  sentences,
  activeIndex,
  onSelect
}: {
  sentences: Sentence[];
  activeIndex: number;
  onSelect: (sentence: Sentence) => void;
}) {
  return (
    <div className="space-y-2">
      {sentences.map((sentence) => (
        <button
          key={sentence.index}
          className={[
            "w-full rounded border px-3 py-2 text-left text-base leading-7",
            sentence.index === activeIndex
              ? "border-amber-500 bg-amber-50"
              : "border-[var(--pa-line)] bg-[var(--pa-surface)]"
          ].join(" ")}
          onClick={() => onSelect(sentence)}
          type="button"
        >
          {sentence.text}
        </button>
      ))}
    </div>
  );
}

