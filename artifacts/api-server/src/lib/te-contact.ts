// Fetches a candidate's real identity/contact from Top Echelon on demand via the
// te-recruit-mcp Worker bridge. Nothing is stored: the contact is fetched only
// when an admin views it or a founder requests an intro, then discarded.

export interface TeContact {
  teId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  currentTitle: string | null;
}

export class TeContactError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "TeContactError";
  }
}

/**
 * Look up a TE person's contact via the Worker. Throws TeContactError if the
 * bridge is unconfigured or the lookup fails, so callers can decide whether to
 * surface the error (admin view) or degrade gracefully (intro webhook).
 */
export async function fetchTeContact(teId: string): Promise<TeContact> {
  const syncUrl = process.env.TE_SYNC_URL;
  const syncSecret = process.env.TE_SYNC_SECRET;
  if (!syncUrl || !syncSecret) {
    throw new TeContactError("TE sync is not configured (TE_SYNC_URL / TE_SYNC_SECRET missing)", 503);
  }

  const res = await fetch(
    `${syncUrl.replace(/\/+$/, "")}/person/${encodeURIComponent(teId)}/contact`,
    { headers: { Authorization: `Bearer ${syncSecret}` }, signal: AbortSignal.timeout(30_000) }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TeContactError(`TE lookup failed (HTTP ${res.status}): ${body.slice(0, 200)}`, 502);
  }

  const c = (await res.json()) as {
    te_id?: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    linkedin: string | null;
    current_title: string | null;
  };
  return {
    teId: c.te_id ?? teId,
    fullName: c.full_name ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    linkedin: c.linkedin ?? null,
    currentTitle: c.current_title ?? null,
  };
}
