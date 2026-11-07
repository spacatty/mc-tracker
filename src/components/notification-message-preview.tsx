"use client";

import { cn } from "@/lib/utils";
import { messagePreviewHtml } from "@/lib/notification-config";

export function NotificationMessagePreview({ message, label = "Message preview", className }: { message: string; label?: string; className?: string }) {
  return <div className={cn("rounded-xl bg-[#111214] p-5", className)} aria-label={label}>
    {label && <p className="mb-4 text-xs text-zinc-500">{label}</p>}
    <div className="max-w-md rounded-xl rounded-bl-sm bg-[#242628] px-4 py-3 text-[13px] leading-[1.7] text-zinc-200">
      <p className="mb-1 text-xs font-semibold text-sky-300">MC Tracker</p>
      <div className="whitespace-pre-wrap break-words [&_b]:font-semibold [&_pre]:whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: messagePreviewHtml(message) }} />
    </div>
  </div>;
}
