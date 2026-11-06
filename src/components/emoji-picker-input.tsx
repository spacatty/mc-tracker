"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** Emoji picker form control: submits the chosen emoji under `name`. Styled like Input (h-9). */
export function EmojiPickerInput({
  name,
  defaultValue = "📦",
  ariaLabel = "Pick an emoji",
  triggerId,
  className,
}: {
  name: string;
  defaultValue?: string;
  ariaLabel?: string;
  triggerId?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={triggerId}
            variant="outline"
            aria-label={ariaLabel}
            className={cn(
              "h-9 w-full justify-between gap-2 bg-white/[0.03] px-3 font-normal hover:border-white/15 hover:bg-white/[0.03] active:scale-100",
              className,
            )}
          >
            <span className="text-base leading-none">{value}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden p-0">
          <EmojiPicker
            open={open}
            onEmojiClick={(emoji) => {
              setValue(emoji.emoji);
              setOpen(false);
            }}
            width={320}
            height={380}
            previewConfig={{ showPreview: false }}
            searchDisabled={false}
            skinTonesDisabled
            lazyLoadEmojis
            theme={Theme.DARK}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
