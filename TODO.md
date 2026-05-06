# TODO

## Future Expansion - Do Not Implement Yet

These items are intentionally deferred. Do not implement them unless explicitly requested.

- Add workspace/organization support.
- Add storage abstraction for possible future backends beyond MongoDB.
- Add multi-tenant SaaS-style isolation and billing only if the product direction changes.

Implementation note for the first version:

- Keep ownership and sharing boundaries clean enough that a future `workspaceId` can be introduced without rewriting the whole data model.
- Prefer MongoDB-specific implementation now, but isolate database access behind application services where it is practical and not overengineered.
