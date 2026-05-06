"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import type { Category } from "@/lib/types";
import { AppIcon } from "./icons";

function SortableCategory({ category }: { category: Category }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-zinc-500 transition group-hover:text-zinc-200" type="button">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ backgroundColor: `${category.color}25`, color: category.color }}>
        <AppIcon name={category.icon} className="h-4 w-4" />
      </span>
      <span className="truncate">{category.name}</span>
    </div>
  );
}

export function CategorySorter({ categories }: { categories: Category[] }) {
  const [items, setItems] = useState(categories);
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    await fetch("/api/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((item) => item.id) }),
    });
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((category) => (
            <SortableCategory key={category.id} category={category} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
