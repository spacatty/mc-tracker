"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { AppIcon, iconNames } from "./icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function IconPicker({ name, defaultValue = "Sparkles" }: { name: string; defaultValue?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const allIcons = Array.isArray(iconNames) ? iconNames : [];
  const popular = useMemo(
    () => ["Globe", "Server", "Boxes", "WalletCards", "Database", "Cloud", "HardDrive", "Router", "Shield", "KeyRound", "Bell", "Zap"],
    [],
  );
  const filteredIcons = allIcons.filter((icon) => icon.toLowerCase().includes(query.toLowerCase())).slice(0, 80);

  function pick(icon: string) {
    setValue(icon);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <AppIcon name={value} className="h-4 w-4" />
              {value}
            </span>
            <ChevronsUpDown className="h-4 w-4 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Lucide icons..." />
          <div className="mt-3 max-h-72 overflow-y-auto">
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">Popular</p>
            <div className="grid grid-cols-2 gap-1">
              {popular.map((icon) => (
                <button key={icon} type="button" onClick={() => pick(icon)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-white/10">
                  <AppIcon name={icon} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{icon}</span>
                  {value === icon ? <Check className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-4 px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">All icons</p>
            <div className="grid grid-cols-2 gap-1">
              {filteredIcons.map((icon) => (
                <button key={icon} type="button" onClick={() => pick(icon)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-white/10">
                  <AppIcon name={icon} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{icon}</span>
                  {value === icon ? <Check className="h-4 w-4" /> : null}
                </button>
              ))}
              {!filteredIcons.length ? <p className="col-span-2 py-6 text-center text-sm text-zinc-500">No icon found.</p> : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
