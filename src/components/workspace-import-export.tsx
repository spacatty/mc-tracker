"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { exportWorkspaceAction, importWorkspaceAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

type ExportOptions = {
  includeWorkspace: boolean;
  includeCategories: boolean;
  includeEntries: boolean;
  includeFolders: boolean;
  includeInvoices: boolean;
  includeWebsiteNotifications: boolean;
};

type ImportSummary = {
  insertedCategories: number;
  skippedCategories: number;
  insertedEntries: number;
  skippedEntries: number;
  insertedFolders: number;
  skippedFolders: number;
  insertedInvoices: number;
  skippedInvoices: number;
  insertedWebsiteNotifications: number;
  skippedWebsiteNotifications: number;
  skippedEntryDetails: Array<{
    name: string;
    reason: string;
  }>;
  warnings: string[];
};

type ImportPreview = {
  sections: string[];
  counts: {
    categories: number;
    entries: number;
    folders: number;
    invoices: number;
    websiteNotifications: number;
  };
};

const defaultOptions: ExportOptions = {
  includeWorkspace: true,
  includeCategories: true,
  includeEntries: true,
  includeFolders: true,
  includeInvoices: false,
  includeWebsiteNotifications: false,
};

export function WorkspaceImportExport({
  workspaceId,
  workspaceRole,
  locale = "en",
}: {
  workspaceId: number;
  workspaceRole: "owner" | "editor" | "viewer";
  locale?: Locale;
}) {
  const [options, setOptions] = useState<ExportOptions>(defaultOptions);
  const [exportError, setExportError] = useState("");
  const [importError, setImportError] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [selectedSkippedEntry, setSelectedSkippedEntry] = useState<{ name: string; reason: string } | null>(null);
  const [isExportPending, startExportTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();
  const canImport = workspaceRole !== "viewer";

  const anySectionEnabled = useMemo(
    () =>
      options.includeWorkspace ||
      options.includeCategories ||
      options.includeEntries ||
      options.includeFolders ||
      options.includeInvoices ||
      options.includeWebsiteNotifications,
    [options],
  );

  function setOption<K extends keyof ExportOptions>(key: K, checked: boolean) {
    setOptions((current) => ({ ...current, [key]: checked }));
  }

  function triggerDownload(content: string, fileName: string) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function onExportWorkspace() {
    setExportError("");
    startExportTransition(async () => {
      try {
        const json = await exportWorkspaceAction(workspaceId, options);
        const fileName = `workspace-export-w${workspaceId}-${new Date().toISOString().slice(0, 10)}.json`;
        triggerDownload(json, fileName);
      } catch (error) {
        setExportError(error instanceof Error ? error.message : t(locale, "errorExportFailed"));
      }
    });
  }

  async function onImportFileChange(file: File | null) {
    setImportError("");
    setImportResult(null);
    if (!file) {
      setImportPayload("");
      setImportPreview(null);
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      setImportPayload(text);
      setImportPreview({
        sections: Array.isArray(data.sections) ? data.sections.map(String) : [],
        counts: {
          categories: Array.isArray(data.categories) ? data.categories.length : 0,
          entries: Array.isArray(data.entries) ? data.entries.length : 0,
          folders: Array.isArray(data.folders) ? data.folders.length : 0,
          invoices: Array.isArray(data.invoices) ? data.invoices.length : 0,
          websiteNotifications: Array.isArray(data.websiteNotifications) ? data.websiteNotifications.length : 0,
        },
      });
    } catch {
      setImportPayload("");
      setImportPreview(null);
      setImportError(t(locale, "errorInvalidJson"));
    }
  }

  function onImportWorkspace() {
    if (!importPayload.trim()) {
      setImportError(locale === "ru" ? "Сначала выберите файл JSON экспорта." : "Choose an export JSON file first.");
      return;
    }
    setImportError("");
    setImportResult(null);
    startImportTransition(async () => {
      try {
        const result = await importWorkspaceAction(workspaceId, importPayload);
        setImportResult(result);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : t(locale, "errorImportFailed"));
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 bg-black/20 p-5">
        <h2 className="text-lg font-semibold text-white">{t(locale, "workspaceImportExport")}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {locale === "ru"
            ? "Экспортируйте данные пространства для переноса между инстансами. Участники и приглашения не экспортируются."
            : "Export workspace data to move between instances. Members and invites are never exported."}
        </p>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="text-sm font-semibold text-violet-100">{t(locale, "exportWorkspace")}</h3>
          <div className="grid gap-2 text-sm text-zinc-300">
            <label className="inline-flex items-center gap-2">
              <Checkbox checked={options.includeWorkspace} onCheckedChange={(value) => setOption("includeWorkspace", value === true)} />
              {locale === "ru" ? "Информация о пространстве" : "Workspace info"}
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox checked={options.includeCategories} onCheckedChange={(value) => setOption("includeCategories", value === true)} />
              {locale === "ru" ? "Категории + кастомные поля" : "Categories + custom fields"}
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox checked={options.includeEntries} onCheckedChange={(value) => setOption("includeEntries", value === true)} />
              {t(locale, "entries")}
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox checked={options.includeFolders} onCheckedChange={(value) => setOption("includeFolders", value === true)} />
              {locale === "ru" ? "Папки + ссылки" : "Folders + links"}
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox checked={options.includeInvoices} onCheckedChange={(value) => setOption("includeInvoices", value === true)} />
              {t(locale, "invoices")}
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox checked={options.includeWebsiteNotifications} onCheckedChange={(value) => setOption("includeWebsiteNotifications", value === true)} />
              {locale === "ru" ? "Website-уведомления" : "Website notifications"}
            </label>
          </div>
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-xs text-violet-100">
            {locale === "ru"
              ? "Экспорт по умолчанию содержит базовые данные. Токены Telegram, участники и приглашения пространства исключены."
              : "Default export is core data. Telegram bot tokens, workspace members, and workspace invites are excluded."}
          </div>
          <Button type="button" onClick={onExportWorkspace} disabled={!anySectionEnabled || isExportPending}>
            {isExportPending ? (locale === "ru" ? "Экспорт..." : "Exporting...") : t(locale, "exportWorkspace")}
          </Button>
          {exportError ? <p className="text-sm text-red-300">{exportError}</p> : null}
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="text-sm font-semibold text-sky-100">{t(locale, "importWorkspace")}</h3>
          <Input type="file" accept="application/json,.json" onChange={(event) => onImportFileChange(event.target.files?.[0] || null)} />
          {importPreview ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-300">
              <p className="font-semibold text-white">{locale === "ru" ? "Обнаруженные разделы" : "Detected sections"}: {importPreview.sections.join(", ") || (locale === "ru" ? "нет" : "none")}</p>
              <p className="mt-1">{t(locale, "categories")}: {importPreview.counts.categories}</p>
              <p>{t(locale, "entries")}: {importPreview.counts.entries}</p>
              <p>{locale === "ru" ? "Папки" : "Folders"}: {importPreview.counts.folders}</p>
              <p>{t(locale, "invoices")}: {importPreview.counts.invoices}</p>
              <p>{locale === "ru" ? "Website-уведомления" : "Website notifications"}: {importPreview.counts.websiteNotifications}</p>
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={onImportWorkspace}
            disabled={!importPayload || isImportPending || !canImport}
          >
            {isImportPending ? (locale === "ru" ? "Импорт..." : "Importing...") : t(locale, "importWorkspace")}
          </Button>
          <p className="text-xs text-zinc-500">{locale === "ru" ? "Импорт безопасен для слияния: существующие данные сохраняются, новые добавляются." : "Import is merge-safe: existing data is kept, and new records are added."}</p>
          {!canImport ? <p className="text-xs text-amber-200">{locale === "ru" ? "У вас доступ viewer в этом пространстве. Для импорта нужна роль editor или owner." : "You have viewer access in this workspace. Import requires editor or owner role."}</p> : null}
          {importError ? <p className="text-sm text-red-300">{importError}</p> : null}
          {importResult ? (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
              <p>{t(locale, "categories")}: +{importResult.insertedCategories} / {locale === "ru" ? "пропущено" : "skipped"} {importResult.skippedCategories}</p>
              <p>{t(locale, "entries")}: +{importResult.insertedEntries} / {locale === "ru" ? "пропущено" : "skipped"} {importResult.skippedEntries}</p>
              {importResult.skippedEntryDetails?.length ? (
                <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-zinc-100">
                  <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                    {locale === "ru" ? "Пропущенные записи" : "Skipped entries"}
                  </p>
                  <ul className="space-y-1">
                    {importResult.skippedEntryDetails.map((entry, index) => (
                      <li key={`${entry.name}-${index}`}>
                        <button
                          type="button"
                          className="rounded px-1 py-0.5 text-left text-emerald-100 underline decoration-emerald-300/40 underline-offset-2 hover:text-white"
                          onClick={() => setSelectedSkippedEntry(entry)}
                        >
                          • {entry.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p>{locale === "ru" ? "Папки" : "Folders"}: +{importResult.insertedFolders} / {locale === "ru" ? "пропущено" : "skipped"} {importResult.skippedFolders}</p>
              <p>{t(locale, "invoices")}: +{importResult.insertedInvoices} / {locale === "ru" ? "пропущено" : "skipped"} {importResult.skippedInvoices}</p>
              <p>{locale === "ru" ? "Website-уведомления" : "Website notifications"}: +{importResult.insertedWebsiteNotifications} / {locale === "ru" ? "пропущено" : "skipped"} {importResult.skippedWebsiteNotifications}</p>
              {importResult.warnings.length ? (
                <div className="mt-2 rounded-lg border border-amber-300/20 bg-amber-500/10 p-2 text-amber-100">
                  {importResult.warnings.slice(0, 4).map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                  {importResult.warnings.length > 4 ? <p>{locale === "ru" ? `...и еще предупреждений: ${importResult.warnings.length - 4}.` : `...and ${importResult.warnings.length - 4} more warning(s).`}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog.Root open={Boolean(selectedSkippedEntry)} onOpenChange={(open) => { if (!open) setSelectedSkippedEntry(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-white">
                  {locale === "ru" ? "Причина пропуска записи" : "Skipped entry details"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-zinc-500">
                  {locale === "ru" ? "Почему эта запись не была импортирована." : "Why this entry was not imported."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Close skipped entry dialog">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            {selectedSkippedEntry ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{locale === "ru" ? "Запись" : "Entry"}</p>
                <p className="mt-1 text-sm font-semibold text-white">{selectedSkippedEntry.name}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-500">{locale === "ru" ? "Причина" : "Reason"}</p>
                <p className="mt-1 text-sm text-zinc-300">{selectedSkippedEntry.reason}</p>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
