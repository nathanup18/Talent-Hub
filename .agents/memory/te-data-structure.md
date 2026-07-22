---
name: Top Echelon MCP data structure quirks
description: Gotchas with the TE MCP API responses that caused hours of debugging.
---

## searchPeople pagination — BROKEN
The `page` parameter is silently ignored. All calls return page 1 results (50 most recently added people), regardless of what page number you pass. The `pagination` object in the response always shows `current_page: 1`.

**Why:** Suspected TE API or MCP proxy issue. Not fixable from our side.

**Impact:** Only 50 unique candidates available via MCP. For a broader sync, need direct TE REST API access (requires API key not in env).

## listPersonActivities — returns object, not array
Response is `{ pagination: {...}, results: [] }` — NOT a bare array. Must use `.results` to get activities.

## Discovery Calls stored as Status Update
"Discovery Call" pipeline stage is NOT stored as activity_type "Discovery Call". Instead it's a `Status Update` activity with "Discovery Call" in the `title` field (e.g., "Discovery Call with Mike W.").

## Large response files
When MCP response > ~32KB, it's saved to `/tmp/mcp_output/*.txt` and `content` field is null. Parse from file using Python with `re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', ' ', raw)` before `json.loads()`.

## "use impure" + MCP callbacks
MCP callbacks cannot be called inside `"use impure"` functions in CodeExecution. Call them in the outer durable scope, pass file paths to impure function for file I/O.

## Activity type IDs
- Screening Interview: `033676f6-2892-42e5-8b5b-bb4f221c85ae`
- Discovery Call: `a3576c99-d25e-46a3-a0c7-63e8f91d9d64`
- Portco Introduction Offered: `0c307dcd-bfe5-40e8-b338-a8f346565665`
