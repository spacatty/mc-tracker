# Archive Feature Implementation Plan

## Overview

Add archive functionality for entries (items) with:
1. Archive action from any entry table's action dropdown
2. Archived entries hidden from lists and stats
3. Separate sidebar section + page for archived entries
4. Restore and hard-delete (with confirmation) from archive
5. Dropdown action buttons on Upcoming Dates table (Quick Edit + Archive)

---

## 1. Database Schema (`src/lib/db.ts`)

### Migration
- Add `archived_at TEXT` column to `items` table (nullable, NULL = not archived)
- Use existing `columnExists` pattern in `migrate()`:
  ```
  if (!columnExists(db, "items", "archived_at")) {
    db.prepare("ALTER TABLE items ADD COLUMN archived_at TEXT").run();
  }
  ```

### mapItem update
- Add `archivedAt: row.archived_at ? String(row.archived_at) : null` to `mapItem()`

---

## 2. Types (`src/lib/types.ts`)

- Add `archivedAt: string | null` to `PaymentItem` type

---

## 3. Data Layer (`src/lib/db.ts`)

### Query changes
- **`listItemsForWorkspace`**: Add `AND (items.archived_at IS NULL)` to WHERE clause
- **`listItemsForUser`**: Add `AND (items.archived_at IS NULL)` to WHERE clause
- **`listItems`**: Add `AND (items.archived_at IS NULL)` to WHERE clause
- **New `listArchivedItemsForWorkspace(workspaceId, userId)`**: Same query as `listItemsForWorkspace` but `WHERE items.archived_at IS NOT NULL`, ordered by `archived_at DESC`

### New functions
- **`archiveItemForWorkspace(id, workspaceId, userId)`**: `requireWorkspaceEditor`, sets `archived_at = nowIso()`
- **`restoreItemForWorkspace(id, workspaceId, userId)`**: `requireWorkspaceEditor`, sets `archived_at = NULL`
- **`deleteArchivedItemForWorkspace(id, workspaceId, userId)`**: `requireWorkspaceEditor`, hard DELETE with `WHERE archived_at IS NOT NULL` safety check
- **`deleteArchivedItemsForWorkspace(ids, workspaceId, userId)`**: Bulk variant

### Stats changes
- **`dashboardStatsForWorkspace`**, **`dashboardStatsGlobalForUser`**, **`dashboardStats`**: These all call `listItemsForWorkspace`/`listItemsForUser`/`listItems` which will already exclude archived items after the query changes above. No additional stats code changes needed.

### Vendor suggestions
- **`listVendorSuggestionsForWorkspace`**: Add `AND (archived_at IS NULL)` filter

### Export
- **`exportWorkspaceForUser`** / **`exportSelectedEntriesForWorkspace`**: Archived items excluded (already filtered by `listItemsForWorkspace`)

---

## 4. Server Actions (`src/app/actions.ts`)

New server actions:
- **`archiveItemAction(formData)`**: Reads `id` + `workspaceId`, calls `archiveItemForWorkspace`, revalidates `/app`, `/app/items`, `/app/archive`
- **`restoreItemAction(formData)`**: Reads `id` + `workspaceId`, calls `restoreItemForWorkspace`, revalidates same paths
- **`deleteArchivedItemAction(formData)`**: Reads `id` + `workspaceId`, calls `deleteArchivedItemForWorkspace`, revalidates same paths
- **`deleteArchivedItemsAction(formData)`**: Bulk variant for selected archived entries

---

## 5. i18n (`src/lib/i18n.ts`)

New dictionary keys:
| Key | EN | RU |
|-----|----|----|
| `archive` | Archive | Архивировать |
| `archived` | Archived | Архив |
| `restore` | Restore | Восстановить |
| `deletePermanently` | Delete permanently | Удалить навсегда |
| `archiveSection` | Archive | Архив |
| `noArchivedEntries` | No archived entries. | Архив пуст. |
| `confirmDeleteArchived` | This will permanently delete this archived entry. This action cannot be undone. | Это навсегда удалит архивную запись. Действие необратимо. |
| `confirmDeleteArchivedTitle` | Delete archived entry? | Удалить архивную запись? |
| `quickEdit` | Quick edit | Быстрое редактирование |

---

## 6. Sidebar (`src/components/app-shell.tsx`)

- Add "Archive" nav item to the `primaryNav` array (after Invoices):
  ```ts
  { href: "/app/archive", label: t(locale, "archived"), icon: "Archive", accent: "text-zinc-300 bg-zinc-500/10" }
  ```
- Add to both desktop and mobile sidebar rendering (already handled by `primaryNav` array)

---

## 7. Archive Page (`src/app/app/archive/page.tsx`)

New server component page:
- `requireUser()`, resolve workspace, fetch `listArchivedItemsForWorkspace()`
- Render a table similar to `entries-table.tsx` but with columns: Name, Category, Account, Archived date, Amount, Actions
- Actions dropdown per row: **Restore** + **Delete permanently** (with confirmation dialog)
- Bulk select with bulk delete (same pattern as entries-table)
- Reuse existing UI components: `Table`, `Badge`, `DropdownMenu`, `Dialog` for confirmations
- Follow same dark theme styling (`bg-[#0b0b10]`, `border-white/10`, etc.)

### Client component: `src/components/archived-entries-table.tsx`
- Extracted client component for interactivity (search, sort, pagination, bulk actions)
- Props: `items: PaymentItem[]`, `workspaceId`, `workspaceRole`, `locale`
- Action dropdown: Restore (calls `restoreItemAction`), Delete permanently (confirmation dialog then `deleteArchivedItemAction`)
- Bulk delete with confirmation (same Radix Dialog pattern as entries-table)

---

## 8. Entries Table Action Dropdown (`src/components/entries-table.tsx`)

Add Archive button to the existing `DropdownMenu` in each row (between Copy URL and Delete):
- Import `Archive` from `lucide-react`
- Import `archiveItemAction` from `@/app/actions`
- Use same `ActionIcon` pattern with `tone="violet"`
- Wrap in form with hidden `id` + `workspaceId` inputs, same as delete pattern

---

## 9. Upcoming Dates Table Dropdown (`src/components/dashboard-upcoming-actions.tsx`)

### Replace inline buttons with a DropdownMenu

Replace the current layout (two inline buttons: Quick Edit + Quick Pay) with a `DropdownMenu` trigger (three-dot `MoreHorizontal` icon, same style as entries-table):

Dropdown items:
1. **Quick Edit** - Link to `/app/items/${itemId}?workspace=${workspaceId}` (sky tone, Edit3 icon)
2. **Quick Pay** - Triggers existing Quick Pay dialog (emerald tone, WalletCards icon)
3. **Archive** - Form submission to `archiveItemAction` (violet tone, Archive icon)

- Add local `ActionIcon` helper (same pattern as entries-table)
- Import `Archive`, `MoreHorizontal` from `lucide-react`
- Import `DropdownMenu*` from `./ui/dropdown-menu`
- Keep the existing Quick Pay dialog markup (triggered from dropdown item `onSelect`)

---

## 10. Workspace Entries Accordion (`src/components/workspace-entries-accordion-table.tsx`)

- Add Archive button alongside the existing Delete button in each row's actions
- Same form/action pattern as entries-table

---

## File Change Summary

| File | Change |
|------|--------|
| `src/lib/db.ts` | Migration (archived_at column), mapItem, query filters, new archive/restore/delete functions |
| `src/lib/types.ts` | Add `archivedAt` to `PaymentItem` |
| `src/lib/i18n.ts` | Add ~9 new translation keys (en + ru) |
| `src/app/actions.ts` | Add 4 new server actions (archive, restore, deleteArchived, deleteArchivedBulk) |
| `src/components/app-shell.tsx` | Add Archive to `primaryNav` sidebar |
| `src/components/entries-table.tsx` | Add Archive to action dropdown |
| `src/components/dashboard-upcoming-actions.tsx` | Replace inline buttons with DropdownMenu (Quick Edit, Quick Pay, Archive) |
| `src/components/workspace-entries-accordion-table.tsx` | Add Archive button to row actions |
| `src/app/app/archive/page.tsx` | **NEW** - Archive page (server component) |
| `src/components/archived-entries-table.tsx` | **NEW** - Client component for archived entries table |

---

## Implementation Order

1. Database migration + types
2. Data layer functions (archive, restore, delete, list archived, query filters)
3. Server actions
4. i18n keys
5. Entries table archive action
6. Upcoming dates dropdown refactor
7. Workspace entries accordion archive action
8. Sidebar archive nav link
9. Archive page + archived entries table component
