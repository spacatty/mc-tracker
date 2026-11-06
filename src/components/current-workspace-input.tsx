"use client";

import { useSearchParams } from "next/navigation";

/**
 * Hidden `currentWorkspace` field: the workspace the user has switched to (the `?workspace=` URL param), so
 * server actions that redirect back to the Workspaces page keep it instead of switching to the edited one.
 */
export function CurrentWorkspaceInput() {
  const current = useSearchParams().get("workspace");
  return current ? <input type="hidden" name="currentWorkspace" value={current} /> : null;
}
