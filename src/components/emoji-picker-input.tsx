"use client";

import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function EmojiPickerInput({
  name,
  defaultValue = "📦",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            <span className="text-lg leading-none">{value}</span>
            <ChevronsUpDown className="h-4 w-4 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto border-white/10 bg-zinc-950 p-0">
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
