"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, Plus, Trash2, Copy, Clock3, ChevronRight } from "lucide-react";
import { deleteNotificationUnitAction, saveNotificationUnitAction } from "@/app/notification-actions";
import { composeUnitMessage, dueDays, entryMessageValues, newNotificationUnit, sampleMessageValues, selectedEntries, zonedClock, type NotificationUnit } from "@/lib/notification-config";
import type { NotificationCenterData } from "@/lib/notification-center";
import { NativeSelect } from "./ui/native-select";
import { DatePickerInput } from "./ui/date-picker";
import { Checkbox } from "./ui/checkbox";
import { Switch } from "./ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Field } from "./ui/field";
import { SectionCard } from "./ui/section-card";
import { Button } from "./ui/button";
import { Input, SearchInput } from "./ui/input";
import { NotificationMessagePreview } from "./notification-message-preview";

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] text-zinc-300"><span>{label}</span><Switch checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} /></label>;
}

export function NotificationCenter({ data, workspaceId, locale, inbox, unreadCount }: { data: NotificationCenterData; workspaceId: number; locale: string; inbox: React.ReactNode; unreadCount: number }) {
  const tx = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [tab, setTab] = useState("units");
  const [editing, setEditing] = useState<NotificationUnit | null>(null);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  function create() {
    const unit = newNotificationUnit(Intl.DateTimeFormat().resolvedOptions().timeZone);
    unit.workspaceIds = [workspaceId];
    setEditing(unit); setRevision((value) => value + 1);
  }
  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight text-zinc-100">{tx("Notification Center", "Центр уведомлений")}</h1><p className="mt-1 text-[13px] text-zinc-500">{tx("Choose what matters. Decide when and where it reaches you.", "Выберите важное. Настройте, когда и куда отправлять уведомления.")}</p></div>{!editing && <Button size="sm" onClick={create}><Plus className="h-4 w-4" />{tx("Create unit", "Создать правило")}</Button>}</div>
    <div className="flex gap-5 border-b border-white/[0.07] text-sm">{[["units", tx("Notification units", "Правила уведомлений"), data.units.length], ["inbox", tx("Inbox", "Входящие"), unreadCount]].map(([id, label, count]) => <button key={id} type="button" onClick={() => setTab(String(id))} className={`-mb-px border-b-2 pb-3 ${tab === id ? "border-zinc-100 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{label} <span className="ml-1 text-xs text-zinc-500">{count}</span></button>)}<Link href={`/app/telegram?workspace=${workspaceId}`} className="ml-auto pb-3 text-xs text-zinc-400 hover:text-white">{tx("Telegram & templates", "Telegram и шаблоны")} <span aria-hidden>↗</span></Link></div>
    {tab === "inbox" ? inbox : <>
      {editing ? <UnitEditor key={revision} initial={editing} data={data} locale={locale} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setStatus(tx("Notification unit saved.", "Правило уведомлений сохранено.")); }} /> : <>
        {data.units.length > 0 && <SearchInput value={query} onChange={setQuery} placeholder={tx("Search notification units…", "Поиск правил…")} className="max-w-sm" />}
        {!data.units.length ? <div className="grid gap-8 rounded-xl bg-white/[0.025] p-6 md:grid-cols-[1fr_0.8fr]"><div className="flex flex-col items-start justify-center"><Bell className="mb-4 h-6 w-6 text-zinc-500" /><h2 className="text-lg font-medium text-zinc-100">{tx("Your reminders, assembled here", "Все напоминания — здесь")}</h2><p className="mb-5 mt-2 max-w-md text-sm leading-6 text-zinc-400">{tx("Combine entries across workspaces, set your rhythm, and send a compact reminder or a single daily summary.", "Объедините записи из разных пространств, настройте расписание и получайте компактные напоминания или общую сводку.")}</p><Button size="sm" variant="secondary" onClick={create}>{tx("Build your first unit", "Создать первое правило")}<ChevronRight className="h-4 w-4" /></Button><p className="mt-4 text-xs text-zinc-500">{tx("Starts 3 days before · every day at 12:30 · fully configurable", "За 3 дня · ежедневно в 12:30 · всё настраивается")}</p></div><NotificationMessagePreview label={tx("Default message · example data", "Сообщение по умолчанию · пример")} message={"<b>Atlas · VPS</b> · 24.00 USD\nDue in 3 days · 2026-11-10\nInfrastructure / Servers\natlas.example.com"} /></div> : <div className="overflow-hidden rounded-xl bg-white/[0.025]">
          {data.units.filter((unit) => unit.name.toLowerCase().includes(query.toLowerCase())).map((unit) => <div key={unit.id} className="flex flex-wrap items-center gap-4 border-b border-white/[0.05] px-4 py-4 last:border-0">
            <div className="min-w-0 flex-1"><button className="text-left text-sm font-medium text-zinc-100 hover:underline" onClick={() => { setEditing(unit); setRevision((value) => value + 1); }}>{unit.name}</button><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500"><span>{unit.mode === "summary" ? tx("Summary", "Сводка") : tx("Reminder", "Напоминание")}</span><span>{unit.scope === "global" ? tx("All accessible workspaces", "Все доступные пространства") : unit.workspaceIds.map((id) => data.workspaces.find((workspace) => workspace.id === id)?.name).filter(Boolean).join(", ")}</span><span><Clock3 className="mr-1 inline h-3 w-3" />{unit.time} · {unit.timezone}</span><span>{unit.repeat ? `${tx("Every", "Каждые")} ${unit.interval} ${unit.intervalUnit === "days" ? tx("days", "дн.") : tx("hours", "ч.")}` : tx("Once", "Однократно")}</span></p>{unit.lastError && <p className="mt-2 text-xs text-amber-300" role="status">{unit.lastError}</p>}{unit.lastSentAt && <p className="mt-1 text-[11px] text-zinc-500">{tx("Last sent", "Отправлено")}: {new Date(unit.lastSentAt).toLocaleString()}</p>}</div>
            <Toggle checked={unit.enabled} disabled={pending} label={unit.enabled ? tx("Enabled", "Включено") : tx("Paused", "Приостановлено")} onChange={(enabled) => start(async () => { const result = await saveNotificationUnitAction({ ...unit, enabled }); setStatus(result.ok ? tx("Unit updated.", "Правило обновлено.") : result.error); })} />
            <Button variant="ghost" size="sm" aria-label={tx("Duplicate unit", "Дублировать правило")} onClick={() => { setEditing({ ...unit, id: 0, name: `${unit.name} (copy)`, enabled: false }); setRevision((value) => value + 1); }}><Copy className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" aria-label={tx("Delete unit", "Удалить правило")} disabled={pending} onClick={() => { if (!window.confirm(tx(`Delete “${unit.name}”?`, `Удалить «${unit.name}»?`))) return; start(async () => { const result = await deleteNotificationUnitAction(unit.id); setStatus(result.ok ? tx("Unit deleted.", "Правило удалено.") : result.error); }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>)}
          {data.units.length > 0 && !data.units.some((unit) => unit.name.toLowerCase().includes(query.toLowerCase())) && <p className="p-6 text-sm text-zinc-500">{tx("No matching units.", "Правила не найдены.")}</p>}
        </div>}
      </>}
    </>}
    {status && <p role="status" className="text-xs text-zinc-400">{status}</p>}
  </div>;
}

function UnitEditor({ initial, data, locale, onClose, onSaved }: { initial: NotificationUnit; data: NotificationCenterData; locale: string; onClose: () => void; onSaved: () => void }) {
  const tx = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [unit, setUnit] = useState(initial);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function patch(values: Partial<NotificationUnit>) { setUnit((current) => ({ ...current, ...values })); }
  function toggle(list: number[], id: number) { return list.includes(id) ? list.filter((value) => value !== id) : [...list, id]; }
  const sourceWorkspaces = data.workspaces.filter((workspace) => unit.scope === "global" || unit.workspaceIds.includes(workspace.id));
  const selected = selectedEntries(unit, data.entries);
  const clock = zonedClock(new Date(), unit.timezone || "UTC");
  const matching = selected.filter((entry) => { const days = dueDays(entry, clock.date); return days !== null && days <= unit.beforeDays && days >= -unit.overdueDays; });
  const preview = selected.find((entry) => entry.id === previewId) || matching[0] || selected[0];
  const template = data.templates.find((candidate) => candidate.id === unit.templateId)?.body || null;
  const previewValues = preview ? entryMessageValues(preview, data.workspaces.find((workspace) => workspace.id === preview.workspaceId)?.name || "", unit.name || tx("Upcoming payments", "Предстоящие платежи"), clock.date) : { ...sampleMessageValues(), "unit.name": unit.name || "Upcoming payments" };
  const summaryEntries = matching.length ? matching : selected;
  const values = { ...previewValues, "summary.count": summaryEntries.length || 1, "summary.entries": summaryEntries.length ? summaryEntries.map((entry) => `${entry.name} · ${entry.amount} ${entry.currency} · ${entryMessageValues(entry, "", "", clock.date)["due.status"]} · ${data.workspaces.find((workspace) => workspace.id === entry.workspaceId)?.name || ""}`).join("\n") : "Atlas · VPS · 24.00 USD · Due in 3 days" };
  const message = composeUnitMessage(unit.mode, template, values);
  function setScope(scope: NotificationUnit["scope"], workspaceIds = unit.workspaceIds) {
    const allowed = data.workspaces.filter((workspace) => scope === "global" || workspaceIds.includes(workspace.id)).map((workspace) => workspace.id);
    patch({ scope, workspaceIds, categoryIds: unit.categoryIds.filter((id) => data.categories.some((category) => category.id === id && allowed.includes(category.workspaceId!))), entryIds: unit.entryIds.filter((id) => data.entries.some((entry) => entry.id === id && allowed.includes(entry.workspaceId!))), excludedIds: unit.excludedIds.filter((id) => data.entries.some((entry) => entry.id === id && allowed.includes(entry.workspaceId!))) });
  }
  function categorySelection(id: number, workspaceId: number, checked: boolean) {
    const entries = data.entries.filter((entry) => entry.categoryId === id && entry.workspaceId === workspaceId).map((entry) => entry.id);
    patch({ categoryIds: checked ? [...new Set([...unit.categoryIds, id])] : unit.categoryIds.filter((value) => value !== id), entryIds: checked && !unit.autoInclude ? [...new Set([...unit.entryIds, ...entries])] : unit.entryIds.filter((value) => !entries.includes(value)), excludedIds: unit.excludedIds.filter((value) => !entries.includes(value)) });
  }
  function entrySelection(id: number, categoryId: number | null, checked: boolean) {
    const inherited = unit.autoInclude && categoryId !== null && unit.categoryIds.includes(categoryId);
    patch({ entryIds: inherited ? unit.entryIds.filter((value) => value !== id) : checked ? [...new Set([...unit.entryIds, id])] : unit.entryIds.filter((value) => value !== id), excludedIds: inherited && !checked ? [...new Set([...unit.excludedIds, id])] : unit.excludedIds.filter((value) => value !== id) });
  }
  const [openWorkspaces, setOpenWorkspaces] = useState<string[]>([String(initial.workspaceIds[0] ?? data.workspaces[0]?.id)]);
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const search = query.trim().toLowerCase();
  const groups = sourceWorkspaces.map((workspace) => {
    const entries = data.entries.filter((entry) => entry.workspaceId === workspace.id);
    const workspaceMatches = workspace.name.toLowerCase().includes(search);
    const categories = [
      ...data.categories.filter((category) => category.workspaceId === workspace.id).map((category) => ({ id: category.id as number | null, name: category.name })),
      { id: null, name: tx("Uncategorized", "Без категории") },
    ].map((category) => {
      const categoryEntries = entries.filter((entry) => entry.categoryId === category.id);
      const matches = workspaceMatches || category.name.toLowerCase().includes(search);
      return { ...category, entries: categoryEntries, visibleEntries: categoryEntries.filter((entry) => matches || `${entry.name} ${entry.host || ""}`.toLowerCase().includes(search)), matches };
    }).filter((category) => (category.id !== null || category.entries.length > 0) && (category.matches || category.visibleEntries.length > 0));
    return { ...workspace, entries, categories };
  }).filter((workspace) => workspace.categories.length || !search);

  const inputNumber = (key: "beforeDays" | "overdueDays" | "interval", min: number, max: number) => (
    <Input id={`notification-${key}`} type="number" min={min} max={max} required value={unit[key]} onChange={(event) => patch({ [key]: Number(event.target.value) })} />
  );

  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      start(async () => {
        const result = await saveNotificationUnitAction(unit);
        if (result.ok) onSaved();
        else setError(result.error);
      });
    }}>
      <SectionCard bodyClassName="flex flex-wrap items-end gap-4">
        <Field label={tx("Unit name", "Название правила")} htmlFor="notification-name" className="min-w-48 flex-1">
          <Input id="notification-name" value={unit.name} onChange={(event) => patch({ name: event.target.value })} required maxLength={100} placeholder={tx("e.g. Infrastructure payments", "Например, оплата инфраструктуры")} />
        </Field>
        <div className="flex min-h-9 items-center gap-5">
          <Toggle checked={unit.enabled} onChange={(enabled) => patch({ enabled })} label={tx("Enabled", "Включено")} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>{tx("Cancel", "Отмена")}</Button>
            <Button size="sm" disabled={pending}>{pending ? tx("Saving…", "Сохранение…") : tx("Save unit", "Сохранить правило")}</Button>
          </div>
        </div>
      </SectionCard>
      {error && <p role="alert" className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{error}</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <SectionCard title={tx("Sources", "Источники")} description={tx("Choose workspaces, then categories or individual entries.", "Выберите пространства, затем категории или отдельные записи.")} actions={<span className="text-xs tabular-nums text-zinc-400">{selected.length} {tx("selected", "выбрано")}</span>} bodyClassName="space-y-5">
            <Field label={tx("Workspace scope", "Область пространств")} htmlFor="notification-scope">
              <NativeSelect id="notification-scope" ariaLabel={tx("Workspace scope", "Область пространств")} value={unit.scope} onChange={(value) => setScope(value as NotificationUnit["scope"])}>
                <option value="selected">{tx("Selected workspaces", "Выбранные пространства")}</option>
                <option value="global">{tx("Global · all accessible workspaces", "Глобально · все доступные пространства")}</option>
              </NativeSelect>
            </Field>
            {unit.scope === "selected" && (
              <Field label={tx("Workspaces", "Пространства")}>
                <div className="flex flex-wrap gap-2">
                  {data.workspaces.map((workspace) => (
                    <label key={workspace.id} className="flex cursor-pointer items-center gap-2 rounded-md bg-white/[0.035] px-3 py-2 text-[13px] text-zinc-300">
                      <Checkbox checked={unit.workspaceIds.includes(workspace.id)} onCheckedChange={() => setScope("selected", toggle(unit.workspaceIds, workspace.id))} />
                      {workspace.name}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <div className="space-y-1.5">
              <Toggle checked={unit.autoInclude} label={tx("Include future entries in selected categories", "Включать новые записи выбранных категорий")} onChange={(autoInclude) => {
                if (!autoInclude) patch({ autoInclude, entryIds: selected.map((entry) => entry.id), excludedIds: [] });
                else patch({ autoInclude, excludedIds: data.entries.filter((entry) => entry.categoryId && unit.categoryIds.includes(entry.categoryId) && sourceWorkspaces.some((workspace) => workspace.id === entry.workspaceId) && !selectedIds.has(entry.id)).map((entry) => entry.id) });
              }} />
              <p className="text-xs leading-5 text-zinc-500">{unit.autoInclude ? tx("Selected categories update automatically. Individual entries can be excluded.", "Выбранные категории обновляются автоматически. Отдельные записи можно исключить.") : tx("Only the current selection is included. Future entries are not added.", "Включены только выбранные записи. Новые записи не добавляются.")}</p>
            </div>
            <div className="space-y-3">
              <SearchInput value={query} onChange={setQuery} placeholder={tx("Search workspaces, categories or entries…", "Поиск пространств, категорий или записей…")} size="sm" />
              <Accordion type="multiple" value={search ? groups.map((workspace) => String(workspace.id)) : openWorkspaces} onValueChange={setOpenWorkspaces} className="max-h-[360px] space-y-2 overflow-y-auto">
                {groups.map((workspace) => (
                  <AccordionItem key={workspace.id} value={String(workspace.id)} className="rounded-lg border border-white/[0.06] bg-white/[0.015]">
                    <AccordionTrigger className="gap-3 px-3 py-3 text-[13px] hover:text-white">
                      <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                      <span className="shrink-0 text-[11.5px] font-normal tabular-nums text-zinc-500">{workspace.entries.filter((entry) => selectedIds.has(entry.id)).length} / {workspace.entries.length}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-2">
                      <Accordion key={search || "browse"} type="multiple" defaultValue={search ? workspace.categories.map((category) => String(category.id)) : []} className="space-y-1">
                        {workspace.categories.map((category) => {
                          const count = category.entries.filter((entry) => selectedIds.has(entry.id)).length;
                          const checked = category.id !== null && (unit.categoryIds.includes(category.id) || category.entries.length > 0 && count === category.entries.length);
                          return (
                            <AccordionItem key={category.id ?? "none"} value={String(category.id)} className="rounded-md border-0 bg-white/[0.025]">
                              <div className="flex items-center gap-2 pl-3 [&>h3]:min-w-0 [&>h3]:flex-1">
                                {category.id !== null && <Checkbox aria-label={`${tx("Select category", "Выбрать категорию")}: ${category.name}`} checked={count > 0 && count < category.entries.length ? "indeterminate" : checked} onCheckedChange={(value) => categorySelection(category.id!, workspace.id, value === true)} />}
                                <AccordionTrigger className="min-w-0 gap-3 py-2.5 pr-3 text-[13px] font-normal text-zinc-300 hover:text-white">
                                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{count} / {category.entries.length}</span>
                                </AccordionTrigger>
                              </div>
                              <AccordionContent className="px-3 pb-2">
                                {category.visibleEntries.map((entry) => (
                                  <label key={entry.id} className="flex cursor-pointer items-start gap-2.5 rounded-md py-2 pl-1 text-xs text-zinc-300">
                                    <Checkbox className="mt-0.5" checked={selectedIds.has(entry.id)} onCheckedChange={(value) => entrySelection(entry.id, entry.categoryId, value === true)} />
                                    <span className="min-w-0 flex-1"><span className="block truncate">{entry.name}</span>{entry.host && <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{entry.host}</span>}</span>
                                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{entry.amount} {entry.currency}</span>
                                  </label>
                                ))}
                                {!category.entries.length && <p className="py-2 text-xs leading-5 text-zinc-500">{tx("No entries yet. Future entries are included when the switch is on.", "Записей пока нет. Новые записи будут включены при включённом переключателе.")}</p>}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                        {!workspace.categories.length && <p className="px-2 py-3 text-xs text-zinc-500">{tx("No categories or entries in this workspace.", "В этом пространстве пока нет категорий и записей.")}</p>}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {!groups.length && <p className="py-4 text-center text-xs text-zinc-500">{sourceWorkspaces.length ? tx("No matching sources.", "Источники не найдены.") : tx("Select a workspace to see its categories and entries.", "Выберите пространство для просмотра категорий и записей.")}</p>}
            </div>
          </SectionCard>

          <SectionCard title={tx("Schedule", "Расписание")} description={tx("Set the due-date window and delivery frequency.", "Настройте окно дат и частоту отправки.")} bodyClassName="space-y-5">
            <Field label={tx("Notification type", "Тип уведомления")} htmlFor="notification-mode">
              <NativeSelect id="notification-mode" ariaLabel={tx("Notification type", "Тип уведомления")} value={unit.mode} onChange={(value) => patch({ mode: value as NotificationUnit["mode"] })}>
                <option value="reminder">{tx("Reminder · one message per entry", "Напоминание · сообщение для каждой записи")}</option>
                <option value="summary">{tx("Summary · one combined message", "Сводка · одно общее сообщение")}</option>
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={unit.mode === "summary" ? tx("Look ahead (days)", "Горизонт (дней)") : tx("Start before due date (days)", "Начинать за (дней до срока)")} htmlFor="notification-beforeDays">{inputNumber("beforeDays", 0, 3650)}</Field>
              <Field label={tx("Continue after due date (days)", "Продолжать после срока (дней)")} htmlFor="notification-overdueDays">{inputNumber("overdueDays", 0, 3650)}</Field>
            </div>
            <Toggle label={tx("Repeat notifications", "Повторять уведомления")} checked={unit.repeat} onChange={(repeat) => patch({ repeat })} />
            {unit.repeat && <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tx("Repeat every", "Повторять каждые")} htmlFor="notification-interval">{inputNumber("interval", 1, 365)}</Field>
              <Field label={tx("Interval", "Интервал")} htmlFor="notification-interval-unit">
                <NativeSelect id="notification-interval-unit" ariaLabel={tx("Interval", "Интервал")} value={unit.intervalUnit} onChange={(value) => patch({ intervalUnit: value as "days" | "hours" })}><option value="days">{tx("Days", "Дней")}</option><option value="hours">{tx("Hours", "Часов")}</option></NativeSelect>
              </Field>
            </div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tx("Send time / interval start", "Время отправки / начало интервала")} htmlFor="notification-time"><Input id="notification-time" type="time" required value={unit.time} onChange={(event) => patch({ time: event.target.value })} /></Field>
              <Field label={tx("Timezone", "Часовой пояс")} htmlFor="notification-timezone"><NativeSelect id="notification-timezone" ariaLabel={tx("Timezone", "Часовой пояс")} value={unit.timezone} onChange={(value) => patch({ timezone: value })}>{[...new Set([unit.timezone, "UTC", ...Intl.supportedValuesOf("timeZone")])].map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</NativeSelect></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tx("Start date (optional)", "Начало (необязательно)")} htmlFor="notification-start-date"><DatePickerInput name="notification-startDate" triggerId="notification-start-date" value={unit.startDate} onChange={(value) => patch({ startDate: value })} locale={locale === "ru" ? "ru" : "en"} /></Field>
              <Field label={tx("End date (optional)", "Окончание (необязательно)")} htmlFor="notification-end-date"><DatePickerInput name="notification-endDate" triggerId="notification-end-date" min={unit.startDate || undefined} value={unit.endDate} onChange={(value) => patch({ endDate: value })} locale={locale === "ru" ? "ru" : "en"} invalid={Boolean(unit.startDate && unit.endDate && unit.endDate < unit.startDate)} /></Field>
            </div>
            <p className="text-xs leading-5 text-zinc-500">{tx("The due day is included. Empty summaries are skipped. Leave the end date empty to keep this unit active.", "День срока включён. Пустые сводки не отправляются. Без даты окончания правило действует постоянно.")}</p>
          </SectionCard>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-0">
          <SectionCard title={tx("Live preview", "Предпросмотр")} description={tx("See the message and the entries it covers.", "Сообщение и записи, которые в него попадут.")} bodyClassName="space-y-4">
            {selected.length > 0 && <Field label={tx("Preview with entry", "Запись для предпросмотра")} htmlFor="notification-preview-entry"><NativeSelect id="notification-preview-entry" ariaLabel={tx("Preview with entry", "Запись для предпросмотра")} value={String(preview?.id || "")} onChange={(value) => setPreviewId(Number(value))}>{selected.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</NativeSelect></Field>}
            <NotificationMessagePreview message={message} label="" className="bg-transparent p-0" />
            {!preview && <p className="text-xs text-zinc-500">{tx("Showing example data. Select sources to preview your entries.", "Показан пример. Выберите источники для предпросмотра своих записей.")}</p>}
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-400"><span>{tx("Selected entries", "Выбрано записей")}</span><span className="tabular-nums text-zinc-200">{selected.length}</span></div>
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-400"><span>{tx("Within the due-date window today", "В окне дат сегодня")}</span><span className="tabular-nums text-zinc-200">{matching.length}</span></div>
            {selected.length > 0 && <div className="max-h-36 space-y-2 overflow-y-auto border-t border-white/[0.06] pt-3">{selected.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-zinc-300">{entry.name}</span><span className="shrink-0 tabular-nums text-zinc-500">{entry.billingEndAt?.slice(0, 10) || tx("No due date", "Без срока")}</span></div>)}</div>}
          </SectionCard>

          <SectionCard title={tx("Delivery", "Доставка")} bodyClassName="space-y-5">
            <Field label={tx("Message template", "Шаблон сообщения")} htmlFor="notification-template"><NativeSelect id="notification-template" ariaLabel={tx("Message template", "Шаблон сообщения")} value={String(unit.templateId || "")} onChange={(value) => patch({ templateId: Number(value) || null })}><option value="">{tx("Default · compact", "По умолчанию · компактный")}</option>{data.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</NativeSelect></Field>
            <Field label={tx("Destinations", "Получатели")}>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-zinc-300"><Checkbox checked={unit.website} onCheckedChange={(checked) => patch({ website: checked === true })} />{tx("Website inbox", "Входящие на сайте")}</label>
                {data.channels.map((channel) => <label key={channel.id} className="flex cursor-pointer items-start gap-2.5 text-[13px] text-zinc-300"><Checkbox className="mt-0.5" checked={unit.channelIds.includes(channel.id)} onCheckedChange={() => patch({ channelIds: toggle(unit.channelIds, channel.id) })} /><span className="min-w-0"><span className="block truncate">{channel.title}</span><span className="text-[11px] text-zinc-500">Telegram</span></span></label>)}
              </div>
            </Field>
            <Link href="/app/telegram" className="inline-block text-xs text-zinc-400 hover:text-white">{tx("Manage Telegram & templates ↗", "Telegram и шаблоны ↗")}</Link>
          </SectionCard>
        </aside>
      </div>
    </form>
  );
}