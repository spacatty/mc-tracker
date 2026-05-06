import "server-only";

import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "./i18n";

export async function getLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(localeCookieName)?.value);
}
