/* Shared CRA sync helpers for Congé & Séminaire flows
   Usage from components:
     import { applySeminarToCra, removeSeminarFromCra, ensureCategoryId, enumerateWeekdaysUTC, ensureCraForMonth } from '@/utils/craSync';
*/

import type { Schema } from '@/amplify/data/resource';

// Comment markers (used by cleanup/protection logic elsewhere)
export const CONGE_COMMENT_PREFIX = '[CONGE] Demande approuvée';
export const SEMINAR_COMMENT_PREFIX = '[SEMINAIRE] Participation confirmée';

/** Normalize label for accent/case-insensitive comparisons */
export function normalizeLabel(s?: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function isSameLabel(a?: string, b?: string): boolean {
  return normalizeLabel(a) === normalizeLabel(b);
}

/** Ensure a Category exists and return its id (accent-insensitive label match). Kind defaults to 'autre'. */
export async function ensureCategoryId(
  client: { models: any },
  label: string,
  kind: 'facturee' | 'non_facturee' | 'autre' = 'autre'
): Promise<string | null> {
  try {
    const { data } = await client.models.Category.list({});
    const all = (data || []) as Array<{ id: string; label?: string; kind?: string }>;
    const found = all.find(c => isSameLabel(c.label, label));
    if (found) return found.id;
    const created = await client.models.Category.create({ label, kind: kind as any });
    const id = (created as any)?.data?.id || (created as any)?.id || null;
    return id;
  } catch {
    return null;
  }
}

/** Enumerate weekdays (Mon-Fri) between start and end (YYYY-MM-DD) inclusive, using UTC math to avoid TZ/DST issues. */
export function enumerateWeekdaysUTC(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const out: string[] = [];
  let t = Date.UTC(sy, (sm || 1) - 1, sd || 1);
  const endUtc = Date.UTC(ey, (em || 1) - 1, ed || 1);
  const dayMs = 24 * 60 * 60 * 1000;
  while (t <= endUtc) {
    const d = new Date(t);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      out.push(`${y}-${m}-${dd}`);
    }
    t += dayMs;
  }
  return out;
}

/** Ensure a CRA document exists for ownerSub and month (YYYY-MM); create draft if needed. Returns the CRA object. */
export async function ensureCraForMonth(
  client: { models: any },
  ownerSub: string,
  month: string
): Promise<any | null> {
  const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
  let cra = (cras || []).find((c: any) => (c as any).owner === ownerSub);
  if (!cra) {
    const created = await client.models.Cra.create({
      month,
      status: 'draft' as any,
      isSubmitted: false as any,
      owner: ownerSub as any,
    });
    cra = ((created as any)?.data) || (created as any);
  }
  return cra as any;
}

async function setCraSaved(client: { models: any }, craId: string) {
  try {
    await client.models.Cra.update({ id: craId, status: 'saved' as any });
  } catch {
    // best effort
  }
}

/** No-op safe emitter to notify CRA grid to refresh if opened elsewhere */
export function emitCraEntriesUpdated() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cra:entries-updated'));
    }
  } catch {
    // ignore
  }
}

/** Core routine: set 1.0 on each weekday in [startDate, endDate] with provided category and comment; idempotent per-day. */
export async function applyFlaggedDaysToCra(options: {
  client: { models: any },
  ownerSub: string,
  startDate: string,
  endDate: string,
  categoryId: string,
  comment: string,
  sourceType?: string,
  sourceId?: string,
  sourceNote?: string,
}) {
  const { client, ownerSub, startDate, endDate, categoryId, comment, sourceType, sourceId, sourceNote } = options;
  const weekdays = enumerateWeekdaysUTC(startDate, endDate);
  if (weekdays.length === 0) return;

  // Group by month to ensure/create respective CRA and operate
  const byMonth: Record<string, string[]> = {};
  weekdays.forEach(d => { const m = d.slice(0, 7); (byMonth[m] ||= []).push(d); });

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (const [month, dates] of Object.entries(byMonth)) {
    const cra = await ensureCraForMonth(client, ownerSub, month);
    if (!cra || !(cra as any).id) continue;
    const craId = (cra as any).id as string;

    for (const d of dates) {
      let ok = false;
      for (let pass = 0; pass < 5 && !ok; pass++) {
        try {
          // Delete all entries for that day (authoritative overwrite)
          const { data: dayList } = await (client.models.CraEntry.list as any)({
            filter: { craId: { eq: craId }, date: { eq: d } },
          });
          const dayEntries = (dayList || []) as any[];
          if (dayEntries.length > 0) {
            await Promise.all(dayEntries.map(e => client.models.CraEntry.delete({ id: (e as any).id })));
          }
          // Create new entry 1.0
          await client.models.CraEntry.create({
            craId: craId as any,
            date: d,
            categoryId: categoryId as any,
            value: 1 as any,
            comment,
            ...(sourceType ? { sourceType } as any : {}),
            ...(sourceId ? { sourceId } as any : {}),
            ...(sourceNote ? { sourceNote } as any : {}),
            owner: ownerSub as any,
          });
          // Verify
          const { data: verify } = await (client.models.CraEntry.list as any)({
            filter: { craId: { eq: craId }, date: { eq: d } },
          });
          const cur = (verify || []) as any[];
          ok = cur.some(e => String((e as any).categoryId) === String(categoryId) && Number((e as any).value) === 1);
          if (!ok) await sleep(250);
        } catch {
          await sleep(250);
        }
      }
    }

    await setCraSaved(client, craId);
  }

  emitCraEntriesUpdated();
}

/** Remove all entries in [startDate, endDate] that correspond to the provided category or contain the marker in comment. */
export async function removeFlaggedDaysFromCra(options: {
  client: { models: any },
  ownerSub: string,
  startDate: string,
  endDate: string,
  categoryId?: string | null,
  commentMarker?: string, // e.g., "[SEMINAIRE]" or "[CONGE]"
  sourceType?: string,
  sourceId?: string,
}) {
  const { client, ownerSub, startDate, endDate, categoryId, commentMarker, sourceType, sourceId } = options;
  const days = enumerateWeekdaysUTC(startDate, endDate);
  if (days.length === 0) return;

  const months = Array.from(new Set(days.map(d => d.slice(0, 7))));

  for (const month of months) {
    try {
      const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
      const userCra = (cras || []).find((c: any) => (c as any).owner === ownerSub);
      if (!userCra) continue;
      const craId = (userCra as any).id as string;
      const { data: allEntries } = await (client.models.CraEntry.list as any)({
        filter: { craId: { eq: craId } },
      });
      const entries = (allEntries || []) as Array<{ id: string; date: string; comment?: string; sourceType?: string; sourceId?: string } & any>;
      const shouldDelete = entries.filter(e => {
        const inRange = days.includes(e.date);
        if (!inRange) return false;
        const matchesSource = (sourceType && sourceId)
          ? (String((e as any).sourceType || '') === String(sourceType) && String((e as any).sourceId || '') === String(sourceId))
          : false;
        const matchesCategory = categoryId ? String((e as any).categoryId) === String(categoryId) : false;
        const matchesMarker = commentMarker ? String(e.comment || '').includes(commentMarker) : false;
        // Prefer precise source match; fall back to legacy heuristics
        return matchesSource || matchesMarker || (matchesCategory && !sourceType && !sourceId);
      });

      if (shouldDelete.length > 0) {
        await Promise.all(shouldDelete.map(e => client.models.CraEntry.delete({ id: e.id })));
      }

      await setCraSaved(client, craId);
    } catch {
      // ignore per month failures
    }
  }

  emitCraEntriesUpdated();
}

/** High-level wrappers for Séminaire */
export async function applySeminarToCra(
  client: { models: any },
  ownerSub: string,
  startDate: string,
  endDate: string,
  title?: string
) {
  const catId = await ensureCategoryId(client, 'Séminaire', 'autre');
  if (!catId) return;
  const base = SEMINAR_COMMENT_PREFIX;
  const comment = title && title.trim().length > 0 ? `${base} • ${title.trim()}` : base;
  await applyFlaggedDaysToCra({ client, ownerSub, startDate, endDate, categoryId: catId, comment });
}

export async function removeSeminarFromCra(
  client: { models: any },
  ownerSub: string,
  startDate: string,
  endDate: string
) {
  const catId = await ensureCategoryId(client, 'Séminaire', 'autre'); // best effort; may be null if never created yet
  await removeFlaggedDaysFromCra({
    client,
    ownerSub,
    startDate,
    endDate,
    categoryId: catId || undefined,
    commentMarker: '[SEMINAIRE]',
  });
}

/** Optional: Congé helpers (kept for parity; existing absences page has inline logic) */
export async function applyLeaveToCra(
  client: { models: any },
  ownerSub: string,
  startDate: string,
  endDate: string,
  reason?: string,
  leaveRequestId?: string
) {
  const catId = await ensureCategoryId(client, 'Congé', 'autre');
  if (!catId) return;
  // Exact mapping: store exactly the provided reason (trimmed), no prefix
  const comment = (reason || '').trim();
  await applyFlaggedDaysToCra({
    client,
    ownerSub,
    startDate,
    endDate,
    categoryId: catId,
    comment,
    sourceType: 'leave',
    sourceId: leaveRequestId,
    sourceNote: comment,
  });
}

export async function removeLeaveFromCra(
  client: { models: any },
  ownerSub: string,
  startDate: string,
  endDate: string,
  leaveRequestId?: string
) {
  const catId = await ensureCategoryId(client, 'Congé', 'autre');
  await removeFlaggedDaysFromCra({
    client,
    ownerSub,
    startDate,
    endDate,
    categoryId: catId || undefined,
    // Prefer precise match; keep marker for legacy entries
    sourceType: leaveRequestId ? 'leave' : undefined,
    sourceId: leaveRequestId,
    commentMarker: leaveRequestId ? undefined : '[CONGE]',
  });
}