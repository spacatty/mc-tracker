"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Textarea } from "./ui/input";

export function MarkdownNotes({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Textarea
        name="notes"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Markdown supported. Keep secrets only if this instance is trusted."
        className="min-h-56 font-mono"
      />
      <div className="prose prose-invert min-h-56 max-w-none rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "_Preview appears here while you type._"}</ReactMarkdown>
      </div>
    </div>
  );
}
