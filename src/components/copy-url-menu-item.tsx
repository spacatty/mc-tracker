"use client";

import { Copy } from "lucide-react";
import { DropdownMenuItem } from "./ui/dropdown-menu";

export function CopyUrlMenuItem({ url }: { url: string }) {
  return (
    <DropdownMenuItem asChild className="gap-3 rounded-xl px-3 py-2.5">
      <button type="button" className="flex w-full items-center gap-2" onClick={() => navigator.clipboard?.writeText(url)}>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10 text-violet-200">
          <Copy className="h-4 w-4" />
        </span>
        <span className="font-medium">Copy URL</span>
      </button>
    </DropdownMenuItem>
  );
}
