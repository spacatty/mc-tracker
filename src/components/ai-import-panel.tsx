"use client";

import { useState, useTransition } from "react";
import { analyzeAiImportAction, createAiImportItemsAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { AiDraftItem, AiImportResult } from "@/lib/ai/payment-extractor";
import type { Category, CategoryField } from "@/lib/types";
import { displayDate, formatMoney, periodLabel } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input, Textarea } from "./ui/input";

function customFieldAliases(field: CategoryField) {
  return [field.id, field.label, field.label.toLowerCase(), field.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")];
}

function customFieldValue(item: AiDraftItem, field: CategoryField) {
  for (const alias of customFieldAliases(field)) {
    if (Object.prototype.hasOwnProperty.call(item.customFields, alias)) {
      return item.customFields[alias];
    }
  }
  return field.type === "checkbox" ? false : "";
}

export function AiImportPanel({
  categories,
  workspaceId,
  configured,
  model,
  locale = "en",
}: {
  categories: Category[];
  workspaceId: number;
  configured: boolean;
  model: string;
  locale?: Locale;
}) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AiImportResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  const [pending, startTransition] = useTransition();

  function updateDraft(index: number, patch: Partial<AiDraftItem>) {
    setResult((current) => {
      if (!current) return current;
      const items = [...current.items];
      items[index] = { ...items[index], ...patch };
      return { ...current, items };
    });
  }

  function updateDraftCustomField(index: number, field: CategoryField, value: unknown) {
    setResult((current) => {
      if (!current) return current;
      const items = [...current.items];
      const item = items[index];
      items[index] = {
        ...item,
        customFields: {
          ...item.customFields,
          [field.id]: value,
        },
      };
      return { ...current, items };
    });
  }

  function analyze(nextAnswers = answers) {
    setError("");
    setCreated("");
    startTransition(async () => {
      try {
        const nextResult = await analyzeAiImportAction(input, nextAnswers, workspaceId);
        setResult(nextResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : (locale === "ru" ? "Ошибка AI Magic." : "AI Magic failed."));
      }
    });
  }

  function createItems(items: AiDraftItem[]) {
    setError("");
    startTransition(async () => {
      try {
        const response = await createAiImportItemsAction(JSON.stringify(items), workspaceId);
        setCreated(
          locale === "ru"
            ? `Применено действий: ${response.created}.`
            : `${response.created} action${response.created === 1 ? "" : "s"} applied.`,
        );
        setResult(null);
        setAnswers({});
        setInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : (locale === "ru" ? "Не удалось создать записи." : "Could not create entries."));
      }
    });
  }

  if (!configured) {
    return (
      <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-black p-6">
        <h2 className="text-lg font-semibold text-white">{locale === "ru" ? "OpenRouter не настроен" : "OpenRouter is not configured"}</h2>
        <p className="mt-2 text-sm text-amber-100/80">{locale === "ru" ? "Установите `OPENROUTER_API_KEY` в `.env.local`, затем перезапустите приложение." : "Set `OPENROUTER_API_KEY` in `.env.local`, then restart the app."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e16] p-5">
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_45%)]" />
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="relative">
            <h2 className="text-lg font-semibold text-white">{locale === "ru" ? "Вставьте неструктурированные платежные данные" : "Paste messy payment data"}</h2>
            <p className="text-sm text-zinc-500">{locale === "ru" ? `Модель: ${model}. AI Magic задает вопросы вместо угадывания недостающих данных.` : `Model: ${model}. AI Magic asks questions instead of guessing missing billing data.`}</p>
          </div>
          <Badge variant="secondary" className="relative border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">{categories.length} {locale === "ru" ? "категорий загружено" : "categories loaded"}</Badge>
        </div>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={locale === "ru" ? "domain sample.com bought at godaddy for $25..." : "domain sample.com bought at godaddy for $25..."}
          className="min-h-56"
        />
        <div className="mt-4 flex gap-3">
          <Button type="button" className="border border-violet-300/20 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25" disabled={pending || !input.trim()} onClick={() => analyze({})}>
            {pending ? (locale === "ru" ? "Анализ..." : "Analyzing...") : (locale === "ru" ? "Анализировать" : "Analyze")}
          </Button>
          <Button type="button" variant="secondary" className="border border-white/10 bg-white/[0.04]" onClick={() => { setInput(""); setResult(null); setAnswers({}); }}>
            {t(locale, "clear")}
          </Button>
        </div>
      </section>

      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
      {created ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{created}</p> : null}

      {result ? (
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0a0d14]">
            <div className="border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-semibold text-white">{result.questions.length ? t(locale, "missingDetails") : t(locale, "reviewExtractedEntries")}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {result.questions.length
                    ? (locale === "ru" ? "Ответьте на вопросы, чтобы AI создал более чистые записи." : "Answer these so the AI can create cleaner entries.")
                    : result.summary || (locale === "ru" ? "Проверьте перед записью в базу данных." : "Review before writing anything to the database.")}
                </p>
              </div>
            </div>

            <div>
              {result.questions.length ? (
                <div className="space-y-3 bg-black/20 p-5">
                  {result.questions.map((question) => (
                    <label key={question.id} className="block">
                      <span className="text-sm text-zinc-300">{question.question}</span>
                      {question.suggestions.length ? (
                        <span className="mt-2 flex flex-wrap gap-2">
                          {question.suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => setAnswers((current) => ({ ...current, [question.id]: suggestion }))}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300 transition hover:border-violet-300/40 hover:text-white"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </span>
                      ) : null}
                      <Input
                        value={answers[question.id] || ""}
                        onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                        placeholder={question.itemName || question.field || (locale === "ru" ? "Ответ" : "Answer")}
                        className="mt-2"
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {result.items.length ? (
                <div className="divide-y divide-white/10">
                  {result.items.map((item, index) => {
                    const category = categories.find((candidate) => candidate.id === item.categoryId);
                    return (
                      <article key={`${item.name}-${index}`} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-white">{item.name}</h3>
                            <Badge variant="secondary" className="uppercase">{item.action}</Badge>
                            <Badge variant={item.paymentType === "recurring" ? "success" : "secondary"}>
                              {item.paymentType === "recurring" ? periodLabel(item.period, item.customPeriodDays) : (locale === "ru" ? "Разовая" : "Single")}
                            </Badge>
                            <Badge variant="secondary">{category?.name || t(locale, "uncategorized")}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">
                            {formatMoney(item.amount, item.currency)} · {item.vendorName || (locale === "ru" ? "Без вендора" : "No vendor")}{item.accountName ? ` · ${item.accountName}` : ""} · {displayDate(item.billingStartAt)} → {displayDate(item.billingEndAt)}
                          </p>
                          {item.confidence ? <p className="mt-1 text-xs text-zinc-600">{item.confidence}</p> : null}
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <label className="text-xs text-zinc-500">
                              {locale === "ru" ? "Действие" : "Action"}
                              <select
                                value={item.action}
                                onChange={(event) => updateDraft(index, { action: event.target.value as AiDraftItem["action"] })}
                                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-zinc-200"
                              >
                                <option value="create">create</option>
                                <option value="edit">edit</option>
                                <option value="pay">pay</option>
                              </select>
                            </label>
                            {(item.action === "edit" || item.action === "pay") ? (
                              <label className="text-xs text-zinc-500">
                                {locale === "ru" ? "ID связанной записи" : "Linked entry id"}
                                <Input
                                  value={item.targetItemId || ""}
                                  onChange={(event) => updateDraft(index, { targetItemId: Number(event.target.value || 0) || null })}
                                  placeholder={locale === "ru" ? "ID существующей записи" : "Existing entry id"}
                                  className="mt-1"
                                />
                              </label>
                            ) : null}
                          </div>
                          {item.action === "pay" ? (
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                              <label className="inline-flex items-center gap-2">
                                <Checkbox
                                  checked={item.shiftDates}
                                  onCheckedChange={(next) => updateDraft(index, { shiftDates: next === true })}
                                />
                                {locale === "ru" ? "Сдвиг дат" : "Shift dates"}
                              </label>
                              <label className="inline-flex items-center gap-2">
                                <Checkbox
                                  checked={item.shiftPaymentPeriod}
                                  onCheckedChange={(next) => updateDraft(index, { shiftPaymentPeriod: next === true })}
                                />
                                {locale === "ru" ? "Изменить период оплаты" : "Change billing period"}
                              </label>
                            </div>
                          ) : null}
                          {item.action !== "pay" && category?.fields.length ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{category.name} fields</p>
                              <div className="grid gap-3 md:grid-cols-2">
                                {category.fields.map((field) => {
                                  const value = customFieldValue(item, field);
                                  return (
                                    <label key={field.id} className="text-xs text-zinc-500">
                                      {field.label}{field.required ? " *" : ""}
                                      {field.type === "textarea" ? (
                                        <Textarea
                                          value={String(value || "")}
                                          onChange={(event) => updateDraftCustomField(index, field, event.target.value)}
                                          className="mt-1 min-h-20"
                                        />
                                      ) : field.type === "checkbox" ? (
                                        <span className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                                          <Checkbox
                                            checked={Boolean(value)}
                                            onCheckedChange={(next) => updateDraftCustomField(index, field, next === true)}
                                          />
                                          Enabled
                                        </span>
                                      ) : field.type === "select" && field.options?.length ? (
                                        <select
                                          value={String(value || "")}
                                          onChange={(event) => updateDraftCustomField(index, field, event.target.value)}
                                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-zinc-200"
                                        >
                                          <option value="">Select...</option>
                                          {field.options.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <Input
                                          value={String(value || "")}
                                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                          onChange={(event) => updateDraftCustomField(index, field, event.target.value)}
                                          className="mt-1"
                                        />
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-white/10 p-5">
              {result.questions.length ? (
                <Button type="button" disabled={pending} onClick={() => analyze(answers)}>
                  {locale === "ru" ? "Продолжить с ответами" : "Continue with answers"}
                </Button>
              ) : null}
              {result.items.length ? (
                <Button type="button" disabled={pending} onClick={() => createItems(result.items)}>
                  {locale === "ru"
                    ? `Применить действий: ${result.items.length}`
                    : `Apply ${result.items.length} action${result.items.length === 1 ? "" : "s"}`}
                </Button>
              ) : null}
            </div>
          </section>
      ) : null}
    </div>
  );
}
