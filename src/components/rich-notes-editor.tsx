"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Pilcrow, Quote, Redo2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

export function RichNotesEditor({
  defaultValue = "",
  ariaLabel = "Notes",
  locale = "en",
}: {
  defaultValue?: string;
  ariaLabel?: string;
  locale?: Locale;
}) {
  const [html, setHtml] = useState(defaultValue);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: locale === "ru"
          ? "Добавьте учетные данные, заметки для восстановления, сведения о продлении или другой полезный контекст..."
          : "Write credentials, recovery notes, renewal details, or anything useful...",
      }),
    ],
    content: defaultValue || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-56 rounded-b-2xl bg-black/25 px-4 py-4 text-sm text-zinc-100 outline-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-blockquote:border-violet-400 prose-blockquote:text-zinc-300",
        "aria-label": ariaLabel,
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  const tools = [
    { label: locale === "ru" ? "Жирный" : "Bold", icon: Bold, active: "bold", run: () => editor?.chain().focus().toggleBold().run() },
    { label: locale === "ru" ? "Курсив" : "Italic", icon: Italic, active: "italic", run: () => editor?.chain().focus().toggleItalic().run() },
    { label: locale === "ru" ? "Маркированный список" : "Bullet list", icon: List, active: "bulletList", run: () => editor?.chain().focus().toggleBulletList().run() },
    { label: locale === "ru" ? "Нумерованный список" : "Ordered list", icon: ListOrdered, active: "orderedList", run: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: locale === "ru" ? "Цитата" : "Quote", icon: Quote, active: "blockquote", run: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: locale === "ru" ? "Абзац" : "Paragraph", icon: Pilcrow, active: "paragraph", run: () => editor?.chain().focus().setParagraph().run() },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <input type="hidden" name="notes" value={html} />
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/30 p-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.label}
              type="button"
              size="sm"
              variant="ghost"
              onClick={tool.run}
              className={cn(editor?.isActive(tool.active) && "bg-violet-500/20 text-violet-100")}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => editor?.chain().focus().undo().run()} title={locale === "ru" ? "Отменить" : "Undo"} aria-label={locale === "ru" ? "Отменить" : "Undo"}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => editor?.chain().focus().redo().run()} title={locale === "ru" ? "Повторить" : "Redo"} aria-label={locale === "ru" ? "Повторить" : "Redo"}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
