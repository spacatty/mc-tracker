"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { deleteMessageTemplateAction, saveMessageTemplateAction, testMessageTemplateAction } from "@/app/notification-actions";
import { DEFAULT_TEMPLATE, TEMPLATE_VARIABLES, entryMessageValues, renderMessage, sampleMessageValues, validateTemplate, zonedClock, type MessageTemplate } from "@/lib/notification-config";
import type { NotificationCenterData } from "@/lib/notification-center";
import { NativeSelect } from "./ui/native-select";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Input, Textarea } from "./ui/input";
import { NotificationMessagePreview } from "./notification-message-preview";

export function TelegramTemplateEditor({ data, locale }: { data: NotificationCenterData; locale: string }) {
  const tx = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [template, setTemplate] = useState<MessageTemplate>({ id: 0, name: "", body: DEFAULT_TEMPLATE });
  const [entryId, setEntryId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const entry = data.entries.find((candidate) => candidate.id === Number(entryId));
  const values = entry ? entryMessageValues(entry, data.workspaces.find((workspace) => workspace.id === entry.workspaceId)?.name || "", "Preview", zonedClock(new Date(), "UTC").date) : sampleMessageValues();
  if (entry) values["summary.entries"] = `${entry.name} · ${entry.amount} ${entry.currency} · ${values["due.status"]}`;
  let invalid = "";
  try { validateTemplate(template.body); } catch (error) { invalid = (error as Error).message; }
  function insert(variable: string) {
    const control = textarea.current;
    const from = control?.selectionStart ?? template.body.length;
    const to = control?.selectionEnd ?? from;
    const token = `{{${variable}}}`;
    setTemplate({ ...template, body: template.body.slice(0, from) + token + template.body.slice(to) });
    requestAnimationFrame(() => { control?.focus(); control?.setSelectionRange(from + token.length, from + token.length); });
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-zinc-100">{tx("Message templates", "Шаблоны сообщений")}</h2><p className="mt-1 text-[13px] text-zinc-500">{tx("One compact message, your own words. Reuse it in any notification unit.", "Компактные сообщения с вашим текстом. Используйте шаблон в любом правиле уведомлений.")}</p></div><Button variant="secondary" size="sm" onClick={() => { setTemplate({ id: 0, name: "", body: DEFAULT_TEMPLATE }); setStatus(""); }}><Plus className="h-4 w-4" />{tx("New template", "Новый шаблон")}</Button></div>
    <div className="grid gap-5 rounded-xl bg-white/[0.025] p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      <div className="space-y-4">
        <Field label={tx("Saved templates", "Сохранённые шаблоны")} htmlFor="telegram-saved-template"><NativeSelect id="telegram-saved-template" ariaLabel={tx("Saved templates", "Сохранённые шаблоны")} value={String(template.id)} onChange={(value) => { setTemplate(data.templates.find((candidate) => candidate.id === Number(value)) || { id: 0, name: "", body: DEFAULT_TEMPLATE }); setStatus(""); }}><option value={0}>{tx("New template", "Новый шаблон")}</option>{data.templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
        <Field label={tx("Template name", "Название шаблона")} htmlFor="telegram-template-name"><Input id="telegram-template-name" maxLength={100} value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} placeholder={tx("Compact payment reminder", "Компактное напоминание об оплате")} /></Field>
        <Field label={tx("Message", "Сообщение")} htmlFor="telegram-template-body"><Textarea id="telegram-template-body" ref={textarea} value={template.body} maxLength={3500} rows={7} onChange={(event) => setTemplate({ ...template, body: event.target.value })} /></Field>
        <p className="text-xs text-zinc-500">{tx("Formatting: <b>bold</b>, <i>italic</i>, <u>, <s>, <code>, <pre>. Click a variable to insert it at the cursor.", "Форматирование: <b>жирный</b>, <i>курсив</i>, <u>, <s>, <code>, <pre>. Нажмите на переменную для вставки.")}</p>
        <div className="flex flex-wrap gap-1.5">{TEMPLATE_VARIABLES.map((variable) => <button key={variable} type="button" onClick={() => insert(variable)} className="rounded bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white">{`{{${variable}}}`}</button>)}</div>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={pending || !!invalid || !template.name.trim()} onClick={() => start(async () => { const result = await saveMessageTemplateAction(template); if (result.ok) { setTemplate({ ...template, id: result.id! }); setStatus(tx("Template saved.", "Шаблон сохранён.")); } else setStatus(result.error); })}>{tx("Save template", "Сохранить шаблон")}</Button><Button variant="ghost" size="sm" onClick={() => setTemplate({ ...template, body: "<b>{{unit.name}}</b> · {{summary.count}}\n{{summary.entries}}" })}>{tx("Use summary layout", "Шаблон сводки")}</Button>{template.id > 0 && <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (!window.confirm(tx("Delete this template?", "Удалить шаблон?"))) return; start(async () => { const result = await deleteMessageTemplateAction(template.id); if (result.ok) { setTemplate({ id: 0, name: "", body: DEFAULT_TEMPLATE }); setStatus(tx("Template deleted.", "Шаблон удалён.")); } else setStatus(result.error); }); }}><Trash2 className="h-4 w-4" />{tx("Delete", "Удалить")}</Button>}</div>
        {(invalid || status) && <p role="status" className="text-xs text-amber-300">{invalid || status}</p>}
      </div>
      <div className="space-y-4">
        <Field label={tx("Preview with entry", "Запись для предпросмотра")} htmlFor="telegram-preview-entry"><NativeSelect id="telegram-preview-entry" ariaLabel={tx("Preview with entry", "Запись для предпросмотра")} value={String(entryId)} onChange={(value) => setEntryId(value)}><option value="">{tx("Example data", "Пример данных")}</option>{data.entries.map((item) => <option key={item.id} value={item.id}>{data.workspaces.find((workspace) => workspace.id === item.workspaceId)?.name} / {item.name}</option>)}</NativeSelect></Field>
        <NotificationMessagePreview message={renderMessage(template.body, values)} label={tx("Telegram preview", "Предпросмотр Telegram")} />
        <div className="space-y-3 rounded-xl bg-white/[0.025] p-4"><p className="text-sm font-medium text-zinc-200">{tx("Try it in Telegram", "Проверить в Telegram")}</p><p className="text-xs leading-5 text-zinc-500">{tx("Sends the current draft, even before you save it. Choose the bot and chat below.", "Отправляет текущий черновик без сохранения. Выберите бота и чат.")}</p><NativeSelect ariaLabel={tx("Test destination", "Маршрут для теста")} value={String(channelId)} onChange={(value) => setChannelId(value)}><option value="">{tx("Select bot / chat", "Выберите бота / чат")}</option>{data.channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title}</option>)}</NativeSelect><Button variant="secondary" size="sm" disabled={pending || !channelId || !!invalid} onClick={() => start(async () => { const result = await testMessageTemplateAction({ body: template.body, channelId: Number(channelId), entryId: entryId ? Number(entryId) : null }); setStatus(result.ok ? tx("Test message sent.", "Тестовое сообщение отправлено.") : result.error); })}><Send className="h-3.5 w-3.5" />{tx("Send test message", "Отправить тест")}</Button>{!data.channels.length && <p className="text-xs text-zinc-500">{tx("Add a Telegram route above to send a test.", "Добавьте Telegram-маршрут выше для тестирования.")}</p>}</div>
      </div>
    </div>
  </section>;
}
