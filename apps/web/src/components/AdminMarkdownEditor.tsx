"use client";

import { useEffect, useRef } from "react";

type EditorInstance = {
  destroy: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
};

export function AdminMarkdownEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const Vditor = (await import("vditor")).default;
      if (!containerRef.current || cancelled) {
        return;
      }
      editorRef.current = new Vditor(containerRef.current, {
        value,
        mode: "ir",
        height: 420,
        cache: { enable: false },
        input: (nextValue: string) => onChange(nextValue),
        preview: { markdown: { toc: true } }
      });
    }

    void load();

    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div>
      <div ref={containerRef} />
      <textarea
        aria-label="正文"
        className="sr-only"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}
