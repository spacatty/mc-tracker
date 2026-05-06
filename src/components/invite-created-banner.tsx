"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

export function InviteCreatedBanner({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => {
    if (typeof window === "undefined") return `/invite/${token}`;
    return `${window.location.origin}/invite/${token}`;
  }, [token]);

  return (
    <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">
      <span>Invite created: </span>
      <button
        type="button"
        className="inline-flex max-w-full items-center gap-2 rounded-md px-1 py-0.5 font-mono hover:bg-white/10"
        onClick={async () => {
          await navigator.clipboard?.writeText(link);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
        title="Copy invite link"
      >
        <span className="truncate">{link}</span>
        {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-fuchsia-100/80" />}
      </button>
    </div>
  );
}

