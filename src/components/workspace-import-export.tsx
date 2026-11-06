"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileJson, Loader2, Upload } from "lucide-react";
import { exportWorkspaceAction, importWorkspaceAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { pluralRu, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Fieldset } from "./ui/field";
import { SectionCard } from "./ui/section-card";

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
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isExportPending, startExportTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();
  const canImport = workspaceRole !== "viewer";
  const fileInputId = `workspace-import-file-${workspaceId}`;

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
      setImportError(locale === "ru" ? "Сначала выберите JSON-файл экспорта." : "Choose an export JSON file first.");
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

  function pickFile(file: File | null) {
    setFileName(file?.name || "");
    void onImportFileChange(file);
  }

  const exportOptions: Array<{ key: keyof ExportOptions; label: string; description?: string }> = [
    { key: "includeWorkspace", label: tx(locale, "Workspace info", "Информация о пространстве"), description: tx(locale, "Name and icon.", "Название и иконка.") },
    { key: "includeCategories", label: tx(locale, "Categories and custom fields", "Категории и дополнительные поля") },
    { key: "includeEntries", label: t(locale, "entries") },
    { key: "includeFolders", label: tx(locale, "Folders and links", "Папки и ссылки") },
    { key: "includeInvoices", label: t(locale, "invoices") },
    { key: "includeWebsiteNotifications", label: tx(locale, "Website notifications", "Уведомления на сайте") },
  ];

  const resultRows: Array<{ label: string; inserted: number; skipped: number }> = importResult
    ? [
        { label: t(locale, "categories"), inserted: importResult.insertedCategories, skipped: importResult.skippedCategories },
        { label: t(locale, "entries"), inserted: importResult.insertedEntries, skipped: importResult.skippedEntries },
        { label: tx(locale, "Folders", "Папки"), inserted: importResult.insertedFolders, skipped: importResult.skippedFolders },
        { label: t(locale, "invoices"), inserted: importResult.insertedInvoices, skipped: importResult.skippedInvoices },
        {
          label: tx(locale, "Website notifications", "Уведомления на сайте"),
          inserted: importResult.insertedWebsiteNotifications,
          skipped: importResult.skippedWebsiteNotifications,
        },
      ]
    : [];

  const previewRows: Array<{ label: string; value: number }> = importPreview
    ? [
        { label: t(locale, "categories"), value: importPreview.counts.categories },
        { label: t(locale, "entries"), value: importPreview.counts.entries },
        { label: tx(locale, "Folders", "Папки"), value: importPreview.counts.folders },
        { label: t(locale, "invoices"), value: importPreview.counts.invoices },
        { label: tx(locale, "Website notifications", "Уведомления на сайте"), value: importPreview.counts.websiteNotifications },
      ]
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title={t(locale, "exportWorkspace")}
        description={tx(
          locale,
          "Download this workspace as JSON to move it to another instance.",
          "Скачайте пространство в JSON, чтобы перенести его на другой сервер.",
        )}
        footer={
          <>
            {exportError ? (
              <p role="alert" className="mr-auto text-xs text-red-300">
                {exportError}
              </p>
            ) : null}
            <Button type="button" size="sm" onClick={onExportWorkspace} disabled={!anySectionEnabled || isExportPending}>
              {isExportPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              {isExportPending ? tx(locale, "Exporting…", "Экспорт…") : t(locale, "exportWorkspace")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Fieldset legend={tx(locale, "Include", "Что включить")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {exportOptions.map((option) => {
                const id = `export-${workspaceId}-${option.key}`;
                return (
                  <div key={option.key} className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      checked={options[option.key]}
                      onCheckedChange={(value) => setOption(option.key, value === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor={id} className="min-w-0 cursor-pointer">
                      <span className="block text-[13px] font-medium text-zinc-200">{option.label}</span>
                      {option.description ? <span className="block text-[11.5px] text-zinc-500">{option.description}</span> : null}
                    </label>
                  </div>
                );
              })}
            </div>
          </Fieldset>
          <Alert tone="info">
            {tx(
              locale,
              "Telegram bot tokens, members and invites are never exported.",
              "Токены Telegram-ботов, участники и приглашения не экспортируются.",
            )}
          </Alert>
        </div>
      </SectionCard>

      <SectionCard
        title={t(locale, "importWorkspace")}
        description={tx(
          locale,
          "Merge-safe: existing data is kept and new records are added.",
          "Безопасное слияние: существующие данные сохраняются, новые добавляются.",
        )}
        footer={
          <Button type="button" size="sm" variant="secondary" onClick={onImportWorkspace} disabled={!importPayload || isImportPending || !canImport}>
            {isImportPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
            {isImportPending ? tx(locale, "Importing…", "Импорт…") : t(locale, "importWorkspace")}
          </Button>
        }
      >
        <div className="space-y-4">
          {!canImport ? (
            <Alert tone="warning">
              {tx(
                locale,
                "You have viewer access here. Importing needs the editor or owner role.",
                "У вас доступ только на просмотр. Для импорта нужна роль редактора или владельца.",
              )}
            </Alert>
          ) : null}

          <label
            htmlFor={fileInputId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pickFile(event.dataTransfer.files?.[0] || null);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition focus-within:ring-2 focus-within:ring-violet-400/40",
              dragging ? "border-violet-400/50 bg-violet-500/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]",
            )}
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400" aria-hidden="true">
              <FileJson className="h-4 w-4" />
            </span>
            {fileName ? (
              <span className="max-w-full truncate text-[13px] font-medium text-zinc-100">{fileName}</span>
            ) : (
              <span className="text-[13px] text-zinc-300">
                {tx(locale, "Drop an export file here or ", "Перетащите файл экспорта сюда или ")}
                <span className="text-violet-300">{tx(locale, "browse", "выберите")}</span>
              </span>
            )}
            <span className="text-[11.5px] text-zinc-500">{tx(locale, "JSON from “Export workspace”", "JSON из «Экспорта пространства»")}</span>
            <input
              id={fileInputId}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => pickFile(event.target.files?.[0] || null)}
            />
          </label>

          {importPreview ? (
            <div className="rounded-lg border border-white/[0.06]">
              <div className="border-b border-white/[0.06] px-3.5 py-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{tx(locale, "Detected sections", "Найденные разделы")}</p>
                <p className="mt-0.5 text-[13px] text-zinc-300">{importPreview.sections.join(", ") || tx(locale, "none", "нет")}</p>
              </div>
              <dl className="divide-y divide-white/[0.05] text-[13px]">
                {previewRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-3.5 py-1.5">
                    <dt className="text-zinc-400">{row.label}</dt>
                    <dd className="font-medium tabular-nums text-zinc-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {importError ? <Alert tone="danger">{importError}</Alert> : null}

          {importResult ? (
            <Alert tone="success" title={tx(locale, "Import finished", "Импорт завершён")}>
              <dl className="mt-1 grid gap-0.5">
                {resultRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <dt>{row.label}</dt>
                    <dd className="tabular-nums">
                      +{row.inserted}
                      <span className="opacity-60"> · {tx(locale, "skipped", "пропущено")} {row.skipped}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {importResult.skippedEntryDetails?.length ? (
                <div className="mt-2">
                  <p className="text-[11.5px] font-medium">{tx(locale, "Skipped entries", "Пропущенные записи")}</p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {importResult.skippedEntryDetails.map((entry, index) => (
                      <li key={`${entry.name}-${index}`}>
                        <button
                          type="button"
                          className="rounded-sm text-left underline decoration-emerald-300/40 underline-offset-2 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                          onClick={() => setSelectedSkippedEntry(entry)}
                        >
                          {entry.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Alert>
          ) : null}

          {importResult?.warnings.length ? (
            <Alert tone="warning">
              {importResult.warnings.slice(0, 4).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {importResult.warnings.length > 4 ? (
                <p>{tx(locale, `…and ${importResult.warnings.length - 4} more warning(s).`, `…и ещё ${importResult.warnings.length - 4} ${pluralRu(importResult.warnings.length - 4, "предупреждение", "предупреждения", "предупреждений")}.`)}</p>
              ) : null}
            </Alert>
          ) : null}
        </div>
      </SectionCard>

      <Dialog
        open={Boolean(selectedSkippedEntry)}
        onOpenChange={(open) => {
          if (!open) setSelectedSkippedEntry(null);
        }}
      >
        <DialogContent size="sm" closeLabel={tx(locale, "Close skipped entry dialog", "Закрыть окно пропущенной записи")}>
          <DialogHeader icon={<FileJson />} tone="warning">
            <DialogTitle>{tx(locale, "Skipped entry", "Пропущенная запись")}</DialogTitle>
            <DialogDescription>{tx(locale, "Why this entry was not imported.", "Почему эта запись не импортирована.")}</DialogDescription>
          </DialogHeader>
          {selectedSkippedEntry ? (
            <DialogBody>
              <dl className="grid gap-3 text-[13px]">
                <div>
                  <dt className="text-xs font-medium text-zinc-400">{t(locale, "entry")}</dt>
                  <dd className="mt-0.5 font-medium text-zinc-100">{selectedSkippedEntry.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-400">{tx(locale, "Reason", "Причина")}</dt>
                  <dd className="mt-0.5 text-zinc-300">{selectedSkippedEntry.reason}</dd>
                </div>
              </dl>
            </DialogBody>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
