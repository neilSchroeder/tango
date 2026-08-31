# Derive the Stream rather than storing it

We promise that a Player never sees the same Puzzle Instance twice. The obvious way
to keep that promise is a server holding a set of puzzles already served to each
Player, but the game ships as a static site with no backend, and we want to keep it
that way. So instead of remembering what a Player has seen, we derive it: their
Stream is a permutation of the Bank seeded by their Player identifier, and the only
state we persist is how far along it they are.

## Consequences

Losing the counter can only skip a Player forward, never back, so the guarantee
survives partial data loss in a way a stored seen-set would not. The seen-set would
also grow without bound; a counter does not.

The guarantee is scoped to a Player, meaning a browser profile. A human on two
devices is two Players and may see a puzzle twice. We accept this: fixing it needs
accounts, which needs a backend, which is the thing we are avoiding.

Browser storage is the single point of failure. Safari deletes script-writable
storage after seven days without user interaction, which would silently reset a
returning Player, so the app must call `navigator.storage.persist()` on load.

## Considered options

A backend was investigated. Cloudflare Workers with D1, and Turso, are the only
options that are genuinely free, always-on, and require no card; hosted Supabase and
Appwrite suspend projects after a week idle, and the "free" tiers on Fly, Railway and
Render are trial credit. But none of them would help. Without accounts, a Player who
loses their local identifier cannot prove to a server who they were, so the server
could not restore anything — a backend would buy cross-device continuity, which we
declined, and nothing else.
