"use client";

import { Plus, Save } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Kbd, tx } from "./capture/shared";

/*
 * Five candidate primary buttons, each shown where it would live: the sidebar
 * create button, a page action and a modal's save. The pick becomes Button `default`.
 */

const STYLES = [
  { key: "orbit", en: "Orbit", ru: "Орбита", pitchEn: "A thin light circles the border; faster on hover.", pitchRu: "Тонкий свет бежит по рамке, быстрее при наведении." },
  { key: "ink", en: "Ink", ru: "Чернила", pitchEn: "Quiet at rest; violet ink floods in on hover.", pitchRu: "Спокойная, при наведении заливается фиолетовым." },
  { key: "aurora", en: "Aurora", ru: "Аврора", pitchEn: "Slow drifting colour behind dark glass.", pitchRu: "Медленно плывущий цвет под тёмным стеклом." },
  { key: "spot", en: "Spotlight", ru: "Прожектор", pitchEn: "A soft glow follows your cursor inside the button.", pitchRu: "Мягкий свет следует за курсором." },
  { key: "sweep", en: "Sweep", ru: "Блик", pitchEn: "Solid violet, a sheen passes every few seconds, ring on hover.", pitchRu: "Сплошной фиолетовый, периодический блик, кольцо при наведении." },
] as const;

function FxButton({ fx, className, children }: { fx: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseMove={fx === "spot" ? (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--x", `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty("--y", `${event.clientY - rect.top}px`);
      } : undefined}
      className={cn("btn-fx inline-flex items-center gap-2 rounded-lg text-[13px] font-semibold", `btn-fx-${fx}`, className)}
    >
      {children}
    </button>
  );
}

export function ButtonVariants({ locale }: { locale: Locale }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {STYLES.map((style, index) => (
        <section key={style.key} className="rounded-xl border border-white/[0.08] bg-surface">
          <div className="flex items-baseline gap-3 border-b border-white/[0.06] px-5 py-3.5">
            <span className="font-mono text-[11px] text-zinc-600">0{index + 1}</span>
            <h2 className="text-[15px] font-semibold text-zinc-100">{tx(locale, style.en, style.ru)}</h2>
            <p className="truncate text-xs text-zinc-500">{tx(locale, style.pitchEn, style.pitchRu)}</p>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-[224px_minmax(0,1fr)]">
            <div className="rounded-lg border border-white/[0.06] bg-surface-muted p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">{tx(locale, "Sidebar", "Сайдбар")}</p>
              <FxButton fx={style.key} className="h-8 w-full px-2.5">
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">{tx(locale, "Create new entry", "Новая запись")}</span>
                <Kbd className="h-[18px] min-w-[18px] border-white/15 bg-white/10 text-zinc-300">N</Kbd>
              </FxButton>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <div className="flex items-center gap-2">
                <FxButton fx={style.key} className="h-8 px-3">
                  <Plus className="h-3.5 w-3.5" />
                  {tx(locale, "Add route", "Добавить маршрут")}
                </FxButton>
                <FxButton fx={style.key} className="h-9 px-4">
                  <Save className="h-4 w-4" />
                  {tx(locale, "Save changes", "Сохранить")}
                </FxButton>
              </div>
              <p className="text-[11px] text-zinc-600">{tx(locale, "Hover and click to see the motion.", "Наведите и нажмите, чтобы увидеть анимацию.")}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
