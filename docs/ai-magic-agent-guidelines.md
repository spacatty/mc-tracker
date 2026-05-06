# AI Magic Agent Guidelines

AI Magic should use the model and structured schemas to understand user intent. Do not add hardcoded word-trigger logic or regular-expression keyword lists to decide whether a prompt means create, edit, pay, renew, or invoice.

## Intent Handling

- Put intent rules in the AI Magic system prompt and response schema.
- Use structured fields like `action`, `targetItemId`, and `amountSource` to carry the model's interpretation.
- Treat model output as a proposal. Backend code may validate, normalize, and reject unsafe output, but should not reinterpret intent from raw prompt keywords.
- Do not add code like `if prompt contains "paid" then action = pay`. This is brittle across languages, typos, phrasing, and context.
- If intent is ambiguous, make AI Magic ask a follow-up question instead of guessing.

## Safe Deterministic Logic

Deterministic code is appropriate for:

- Schema validation.
- User ownership and permission checks.
- Currency normalization from structured currency fields.
- Date/period arithmetic after the model has selected a structured action.
- Amount calculation from structured fields, such as `amountSource !== "explicit"` on a `pay` action with a linked entry.

Deterministic code is not appropriate for:

- Inferring action intent from hardcoded prompt keywords.
- Guessing whether a user meant invoice payment vs entry edit from a regex.
- Overriding `action` based on isolated words without considering the full prompt and existing entry context.

## OpenRouter Context

Only send the minimum current-user context needed for matching:

- Entry id.
- Entry name.
- Category.
- Amount and currency.
- Billing period and dates.
- Vendor labels.

Never send admin data, roles beyond what is needed for the request, auth secrets, TOTP secrets, sessions, invite tokens, or unrelated user data.

## Review Flow

AI Magic results are reviewable proposals. The UI should show what will happen before applying:

- `create`: creates a new entry.
- `edit`: updates an existing entry.
- `pay`: creates an invoice/payment record for an existing entry.

When a user describes a completed billing event and the model cannot confidently decide whether entry metadata changed, AI Magic should ask a question such as whether anything changed or whether the billing period changed.