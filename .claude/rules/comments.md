---
paths: ["source/**"]
---

# Code Comments (`source/**`)

Write clean, concise, self-documenting code — no explanatory comments or JSDoc. Clear names and structure carry the intent; conventions and rationale live in `.claude/rules/` and skills, not in code comments.

**Exception — `source/data/payloads/**`:** captured request bodies encode Momentus server behaviour and correlation constraints that can't be read off the payload itself — why a cell is pinned to a value, why a date is offset, why a stamp is echoed back, which fields the server assigns on save. State that external rationale in a concise comment next to the value it governs; the knowledge is payload-specific and would be lost if relocated to a rules file. Keep the comment to the *why* (server/correlation behaviour) — don't restate what the literal already shows.

Some existing files still carry heavy JSDoc from before this convention; match the comment-free style for anything you author or edit rather than mirroring theirs.
