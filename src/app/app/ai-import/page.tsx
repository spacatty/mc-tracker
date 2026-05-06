import { AiImportPanel } from "@/components/ai-import-panel";
import { AiMagicFeaturesDialog } from "@/components/ai-magic-features-dialog";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { openRouterConfigured } from "@/lib/ai/openrouter";
import { listCategoriesForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function AiImportPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);

  if (!user.premium) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0c14] p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_50%)]" />
        <Badge variant="secondary" className="relative">{t(locale, "premiumLocked")}</Badge>
        <h1 className="relative mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{t(locale, "aiMagicPremiumFeature")}</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#090b12] p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_42%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.2),transparent_50%)]" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{locale === "ru" ? "Преобразуйте хаотичный текст в действия" : "Turn messy text into actions"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="border border-violet-300/20 bg-violet-500/10 text-violet-100">{t(locale, "aiMagic")}</Badge>
            <AiMagicFeaturesDialog locale={locale} />
          </div>
        </div>
      </header>

      <AiImportPanel
        workspaceId={workspace.id}
        categories={listCategoriesForWorkspace(workspace.id, user.id)}
        configured={openRouterConfigured()}
        model={process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite"}
        locale={locale}
      />
    </div>
  );
}
