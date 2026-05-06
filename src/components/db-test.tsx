"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function DatabaseTester({ locale = "en" }: { locale?: Locale }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function test() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/db-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const body = (await response.json()) as { message: string };
    setMessage(body.message);
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">External database connection test</h2>
        <p className="text-sm text-zinc-400">
          {locale === "ru"
            ? "По умолчанию используется SQLite. Здесь можно проверить PostgreSQL/MySQL URL без переключения текущего хранилища."
            : "SQLite is used by default. This checks future PostgreSQL/MySQL URLs without switching storage yet."}
        </p>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="postgresql://user:pass@host:5432/db or mysql://user:pass@host:3306/db"
          className="min-h-11 flex-1"
        />
        <Button
          type="button"
          onClick={test}
          disabled={loading}
        >
          {loading ? (locale === "ru" ? "Проверка..." : "Testing...") : (locale === "ru" ? "Проверить" : "Test")}
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-zinc-300">{message}</p> : null}
    </div>
  );
}
