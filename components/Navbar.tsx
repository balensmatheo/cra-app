"use client";
import React, { useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Image from "next/image";
import { signOut, fetchAuthSession } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import { IconButton, Avatar, Menu, MenuItem, Tooltip, Badge, Popover, Box as MuiBox, Typography, Button, Divider, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import Grow from '@mui/material/Grow';
import MenuIcon from '@mui/icons-material/Menu';
import CRADrawer from './CRADrawer';
import { useCRA } from '@/context/CRAContext';

export default function Navbar() {
  const client = React.useMemo(() => generateClient<Schema>(), []);
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { submittedMonths, monthStatusMap, monthLockedMap, currentYear, setMonthString } = useCRA() as {
    submittedMonths: number[];
    monthStatusMap?: Record<number, string>;
    monthLockedMap?: Record<number, boolean>;
    currentYear: number;
    setMonthString: (ym: string) => void;
  };
  const open = Boolean(anchorEl);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentSub, setCurrentSub] = useState<string | null>(null);
  const [inboxAnchor, setInboxAnchor] = useState<HTMLElement | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingList, setPendingList] = useState<Array<Schema['LeaveRequest']['type']>>([]);
  const [adminInboxLoading, setAdminInboxLoading] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, { given?: string; family?: string }>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<Schema['LeaveRequest']['type'] | null>(null);
  const [noteText, setNoteText] = useState('');
  // Loading state for inline approve/refuse actions in the admin popover
  const [actionLoading, setActionLoading] = useState<Record<string, 'approuvee' | 'refusee' | undefined>>({});
  // User inbox
  const [userInboxAnchor, setUserInboxAnchor] = useState<HTMLElement | null>(null);
  const [myRequests, setMyRequests] = useState<Array<Schema['LeaveRequest']['type']>>([]);
  const [userInboxLoading, setUserInboxLoading] = useState(false);
  // Seminar invites (user inbox)
  const [myInvites, setMyInvites] = useState<Array<Schema['SeminarInvite']['type']>>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteActionLoading, setInviteActionLoading] = useState<Record<string, 'accepted' | 'refused' | undefined>>({});
  const adminFetchInFlight = React.useRef(false);
  const userFetchInFlight = React.useRef(false);
  // Refuse dialog for seminar invites
  const [refuseDialog, setRefuseDialog] = useState<{
    open: boolean;
    inviteId: string;
    reason: string;
  }>({ open: false, inviteId: '', reason: '' });
  React.useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
  if (!session?.tokens) return;
  const sub = session.tokens.idToken?.payload.sub as string | undefined;
  if (sub) setCurrentSub(sub);
        const groups = (session.tokens.idToken?.payload as any)?.['cognito:groups'] as string[] | undefined;
        setIsAdmin(!!groups?.includes('ADMINS'));
        const key = 'profile/avatar';
        const { url } = await getUrl({ key, options: { accessLevel: 'protected', expiresIn: 300 } });
        setAvatarUrl(url.toString());
      } catch (e) {
        // Avatar is optional; ignore failures
      }
    })();
  }, []);

  // Load Cognito users to resolve names when admin
  React.useEffect(() => {
    (async () => {
      if (!isAdmin) return;
      try {
        const { data, errors } = await client.queries.listUsers({});
        if (errors) return;
        const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
        const users = (payload?.users || []) as any[];
        const map: Record<string, { given?: string; family?: string }>= {};
        users.forEach(u => { map[u.username] = { given: u.given_name, family: u.family_name }; });
        setNameMap(map);
      } catch (e) {
        // ignore
      }
    })();
  }, [isAdmin]);

  const fetchPending = useCallback(async () => {
    if (!isAdmin) return;
    if (adminFetchInFlight.current) return;
    try {
      adminFetchInFlight.current = true;
      setAdminInboxLoading(true);
      const { data } = await client.models.LeaveRequest.list({
        filter: { status: { eq: 'pending' as any } }
      });
      const list = (data || []) as Array<Schema['LeaveRequest']['type']>;
      setPendingList(list);
      setPendingCount(list.length);
    } catch (e) {
      console.error('Failed to fetch pending leave requests', e);
    } finally {
      setAdminInboxLoading(false);
      adminFetchInFlight.current = false;
    }
  }, [client, isAdmin]);


  // (moved below fetchMyRequests & fetchMyInvites definitions to avoid TDZ errors)

  const openInbox = (e: React.MouseEvent<HTMLElement>) => {
    setInboxAnchor(e.currentTarget);
    fetchPending();
  };

  const closeInbox = () => setInboxAnchor(null);

  // Helper: find or create the Congé category and return its id
  const ensureCongeCategoryId = async (): Promise<string | null> => {
    try {
      const { data } = await client.models.Category.list({});
      const all = (data || []) as any[];
      let conge = all.find(c => (c.label || '').toLowerCase() === 'congé' || (c.label || '').toLowerCase() === 'conge');
      if (conge) return conge.id as string;
      // Create it under kind 'autre'
      const created = await client.models.Category.create({ label: 'Congé', kind: 'autre' as any });
      return (created as any)?.data?.id || (created as any)?.id || null;
    } catch (e) {
      console.error('ensureCongeCategoryId failed', e);
      return null;
    }
  };

  // Helper: find or create the Séminaire category and return its id
  const ensureSeminaireCategoryId = async (): Promise<string | null> => {
    try {
      const { data } = await client.models.Category.list({});
      const all = (data || []) as any[];
      const match = all.find(c => {
        const lbl = (c.label || '').toLowerCase();
        return lbl === 'séminaire' || lbl === 'seminaire';
      });
      if (match) return match.id as string;
      const created = await client.models.Category.create({ label: 'Séminaire', kind: 'autre' as any });
      return (created as any)?.data?.id || (created as any)?.id || null;
    } catch (e) {
      console.error('ensureSeminaireCategoryId failed', e);
      return null;
    }
  };

  // Helper: get or create CRA for a given owner and month (YYYY-MM)
  const ensureCraForMonth = async (ownerSub: string, month: string) => {
    const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
    let cra = (cras || []).find(c => (c as any).owner === ownerSub);
    if (!cra) {
      const created = await client.models.Cra.create({ month, status: 'draft' as any, isSubmitted: false as any, owner: ownerSub as any });
      cra = ((created as any)?.data) || (created as any);
    }
    return cra as any;
  };

  // Helper: enumerate all days (including weekends) for seminars
  const enumerateAllDays = (start: string, end: string): string[] => {
    console.log(`enumerateAllDays called with start: ${start}, end: ${end}`);
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const out: string[] = [];
    
    // Create dates without timezone issues
    const startDate = new Date(sy, sm - 1, sd);
    const endDate = new Date(ey, em - 1, ed);
    
    console.log(`Start date object: ${startDate.toISOString()}, End date object: ${endDate.toISOString()}`);
    
    // Iterate through each day
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const dayOfWeek = currentDate.getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      console.log(`Adding date: ${dateStr} (${dayName})`);
      
      out.push(dateStr);
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`enumerateAllDays result: ${JSON.stringify(out)}`);
    return out;
  };

  // After seminar acceptance, reflect days into CRA entries for the user (robust, with verification and retries)
  const applySeminarToCra = async (ownerSub: string, startDate: string, endDate: string) => {
    const categoryId = await ensureSeminaireCategoryId();
    if (!categoryId) return;

    // Generate inclusive date range using local time (noon to avoid DST edges)
    const genDates = (start: string, end: string): string[] => {
      const out: string[] = [];
      const [sy, sm, sd] = start.split('-').map(n => parseInt(n, 10));
      const [ey, em, ed] = end.split('-').map(n => parseInt(n, 10));
      let cur = new Date(sy, (sm || 1) - 1, sd || 1, 12, 0, 0);
      const until = new Date(ey, (em || 1) - 1, ed || 1, 12, 0, 0);
      while (cur <= until) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        out.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }
      return out;
    };

    const allDates = genDates(startDate, endDate);
    const byMonth: Record<string, string[]> = {};
    for (const d of allDates) { const m = d.slice(0, 7); (byMonth[m] ||= []).push(d); }

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    const baseComment = '[SEMINAIRE] Invitation acceptée';

    for (const [month, dates] of Object.entries(byMonth)) {
      const cra = await ensureCraForMonth(ownerSub, month);
      if (!cra || !(cra as any).id) continue;
      const craId = (cra as any).id as string;

      // Up to 3 passes to overcome eventual consistency
      for (let pass = 0; pass < 3; pass++) {
        try {
          const { data: listRaw } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
          const existing = (listRaw || []) as any[];
          const present = new Set(existing.map(e => (e as any).date as string));

          for (const d of dates) {
            const found = existing.find(e => (e as any).date === d);
            try {
              if (found) {
                await client.models.CraEntry.update({
                  id: (found as any).id,
                  craId: craId as any,
                  date: d,
                  categoryId: categoryId as any,
                  value: 1 as any,
                  comment: baseComment,
                  owner: ownerSub as any,
                });
              } else {
                await client.models.CraEntry.create({
                  craId: craId as any,
                  date: d,
                  categoryId: categoryId as any,
                  value: 1 as any,
                  comment: baseComment,
                  owner: ownerSub as any,
                });
              }
            } catch {}
          }

          // Verify presence of all dates
          const { data: verifyRaw } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
          const cur = (verifyRaw || []) as any[];
          const have = new Set(cur.map(e => (e as any).date as string));
          const missing = dates.filter(d => !have.has(d));
          if (missing.length === 0) break;
        } catch {}
        await sleep(250);
      }

      try { await client.models.Cra.update({ id: craId, status: 'saved' as any }); } catch {}
    }

    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new Event('cra:entries-updated')); } catch {}
    }
  };

  // Helper: iterate dates inclusive and return business days (Mon-Fri) using UTC to avoid DST/TZ issues
  const enumerateWeekdays = (start: string, end: string): string[] => {
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
  };

  // After approval, reflect days into CRA entries for the request owner (robust with verification/retries)
  const applyApprovedLeaveToCra = async (ownerSub: string, startDate: string, endDate: string, comment: string, leaveId?: string) => {
    const categoryId = await ensureCongeCategoryId();
    if (!categoryId) return;
    const weekdays = enumerateWeekdays(startDate, endDate);
    if (weekdays.length === 0) return;
    const byMonth: Record<string, string[]> = {};
    weekdays.forEach(d => { const m = d.slice(0,7); (byMonth[m] ||= []).push(d); });

  const cmnt = (comment || '').trim();
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (const [month, dates] of Object.entries(byMonth)) {
      const cra = await ensureCraForMonth(ownerSub, month);
      if (!cra || !(cra as any).id) continue;
      const craId = (cra as any).id as string;

      // Per-date authoritative operations with retries to avoid pagination and consistency issues
      for (const d of dates) {
        let ok = false;
        for (let pass = 0; pass < 5 && !ok; pass++) {
          try {
            // Remove previous leave-sourced entries for this date (don't touch other sources)
            const { data: dayList } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId }, date: { eq: d } } });
            const dayEntries = (dayList || []) as any[];
            const toDelete = dayEntries.filter(e => String((e as any).sourceType || '') === 'leave');
            if (toDelete.length > 0) {
              await Promise.all(toDelete.map(e => client.models.CraEntry.delete({ id: (e as any).id })));
            }
            // Create Congé entry with exact comment and source metadata
            await client.models.CraEntry.create({
              craId: craId as any,
              date: d,
              categoryId: categoryId as any,
              value: 1 as any,
              comment: cmnt,
              sourceType: 'leave' as any,
              sourceId: leaveId as any,
              sourceNote: cmnt as any,
              owner: ownerSub as any,
            });
            // Verify
            const { data: verify } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId }, date: { eq: d } } });
            const cur = (verify || []) as any[];
            ok = cur.some(e => String((e as any).categoryId) === String(categoryId) && Number((e as any).value) === 1);
            if (!ok) await sleep(250);
          } catch {
            await sleep(250);
          }
        }
      }

      // Final reconciliation: ensure all expected weekdays are present, and no weekend entries slipped in
      try {
        const { data: allRaw } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
        const all = (allRaw || []) as any[];
        const weekdaySet = new Set(dates);
        const haveWeekdays = new Set(all
          .filter(e => String((e as any).categoryId) === String(categoryId) && String((e as any).sourceType || '') === 'leave')
          .map(e => (e as any).date as string));
        // Create any missing weekday entries (one more pass)
        for (const d of dates) {
          if (!haveWeekdays.has(d)) {
            try {
              await client.models.CraEntry.create({
                craId: craId as any,
                date: d,
                categoryId: categoryId as any,
                value: 1 as any,
                comment: cmnt,
                sourceType: 'leave' as any,
                sourceId: leaveId as any,
                sourceNote: cmnt as any,
                owner: ownerSub as any,
              });
            } catch {}
          }
        }
        // Defensive cleanup: remove any Congé entries in this CRA that fall on weekends within the requested range
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const s = Date.UTC(sy, (sm || 1) - 1, sd || 1);
        const e = Date.UTC(ey, (em || 1) - 1, ed || 1);
        for (const entry of all) {
          if (String((entry as any).categoryId) !== String(categoryId)) continue;
          const dstr = (entry as any).date as string;
          const [y, m, dd] = dstr.split('-').map(Number);
          const t = Date.UTC(y, (m || 1) - 1, dd || 1);
          if (t < s || t > e) continue;
          const wd = new Date(t).getUTCDay();
          if (wd === 0 || wd === 6) {
            try { await client.models.CraEntry.delete({ id: (entry as any).id }); } catch {}
          }
        }
      } catch {}

      try { await client.models.Cra.update({ id: craId, status: 'saved' as any }); } catch {}
    }

    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new Event('cra:entries-updated')); } catch {}
    }
  };

  const updateStatus = async (
    id: string,
    status: 'approuvee' | 'refusee',
    adminNote?: string,
    owner?: string | null,
    req?: { startDate: string; endDate: string; reason?: string }
  ) => {
    try {
      await client.models.LeaveRequest.update({
        id,
        status: status as any,
        adminNote,
        userRead: false as any,   // ensure it appears as unread for the user
        userHidden: false as any, // ensure it is visible in user inbox
        ...(owner ? { owner } as any : {}), // preserve ownership if provided
      });
      const next = pendingList.filter((r) => r.id !== id);
      setPendingList(next);
      setPendingCount(next.length);
      // Apply to CRA if approved — exact copy of the user's reason (no prefix)
      if (status === 'approuvee' && owner && req) {
        const note = (req && (req.reason || '')) || (adminNote || '');
        await applyApprovedLeaveToCra(owner, req.startDate, req.endDate, note, id);
      } else if (status === 'refusee' && owner && req) {
        // If refusing, remove only entries linked to this leave
        await removeApprovedLeaveFromCra(owner, req.startDate, req.endDate, id);
      }
    } catch (e) {
      console.error('Failed to update leave request', e);
    }
  };

  // Remove previously applied approved leave entries from CRA for the given period (only entries linked to this leave)
  const removeApprovedLeaveFromCra = async (ownerSub: string, startDate: string, endDate: string, leaveId?: string) => {
    const days = enumerateWeekdays(startDate, endDate);
    if (days.length === 0) return;
    const byMonth: Record<string, string[]> = {};
    days.forEach(d => { const m = d.slice(0,7); (byMonth[m] ||= []).push(d); });
    for (const [month] of Object.entries(byMonth)) {
      try {
        const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: month } } });
        const userCra = (cras || []).find((c: any) => (c as any).owner === ownerSub);
        if (!userCra) continue;
        const craId = (userCra as any).id as string;
        // Delete only entries sourced by this leave (fallback: entries containing legacy marker)
        const { data: allEntries } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: craId } } });
        const toDelete = ((allEntries || []) as any[]).filter(e => {
          const d = (e as any).date as string;
          const inRange = days.includes(d);
          if (!inRange) return false;
          if (leaveId) return String((e as any).sourceType || '') === 'leave' && String((e as any).sourceId || '') === String(leaveId);
          return String((e as any).comment || '').includes('[CONGE]');
        });
        if (toDelete.length > 0) {
          await Promise.all(toDelete.map(e => client.models.CraEntry.delete({ id: (e as any).id })));
        }
        try { await client.models.Cra.update({ id: craId, status: 'saved' as any }); } catch {}
      } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new Event('cra:entries-updated')); } catch {}
    }
  };

  const fullName = (sub?: string | null) => {
    if (!sub) return '';
    const n = nameMap[sub];
    if (!n) return `${sub.slice(0, 10)}…`;
    const parts = [n.given, n.family].filter(Boolean);
    return parts.length ? parts.join(' ') : `${sub.slice(0, 10)}…`;
  };

  const openDetails = (req: Schema['LeaveRequest']['type']) => {
    setSelectedReq(req);
    setNoteText('');
    setDetailsOpen(true);
  };
  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedReq(null);
    setNoteText('');
  };
  const [detailsLoading, setDetailsLoading] = useState<'approuvee' | 'refusee' | null>(null);
  const handleApproveWithNote = async () => {
    if (!selectedReq) return;
    setDetailsLoading('approuvee');
    try {
      await updateStatus(selectedReq.id, 'approuvee', noteText || undefined, (selectedReq as any).owner, { startDate: selectedReq.startDate, endDate: selectedReq.endDate, reason: (selectedReq as any).reason });
      closeDetails();
    } finally {
      setDetailsLoading(null);
    }
  };
  const handleRejectWithNote = async () => {
    if (!selectedReq) return;
    setDetailsLoading('refusee');
    try {
      await updateStatus(selectedReq.id, 'refusee', noteText || undefined, (selectedReq as any).owner, { startDate: selectedReq.startDate, endDate: selectedReq.endDate, reason: (selectedReq as any).reason });
      closeDetails();
    } finally {
      setDetailsLoading(null);
    }
  };

  // User inbox: fetch own requests
  const fetchMyRequests = useCallback(async () => {
    if (!currentSub) return;
    if (userFetchInFlight.current) return;
    try {
      userFetchInFlight.current = true;
      setUserInboxLoading(true);
      // allow.owner() already restricts results to the current user
      const { data } = await client.models.LeaveRequest.list({});
      const list = ((data || []) as Array<Schema['LeaveRequest']['type']>)
        .filter(r => String((r as any).owner || '') === String(currentSub))
        .filter(r => !(r as any).userHidden)
        .sort((a: any, b: any) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      setMyRequests(list);
    } catch (e) {
      console.error('Failed to fetch my leave requests', e);
    } finally {
      setUserInboxLoading(false);
      userFetchInFlight.current = false;
    }
  }, [client, currentSub]);

  const fetchMyInvites = useCallback(async () => {
    if (!currentSub) return;
    try {
      setInvitesLoading(true);
      console.log('Fetching seminar invites for user:', currentSub);
      const { data } = await (client.models.SeminarInvite.list as any)({});
      console.log('Raw seminar invites data:', data);
      const list = ((data || []) as Array<Schema['SeminarInvite']['type']>)
        .filter(i => {
          const matches = String((i as any).owner || '') === String(currentSub);
          console.log('Invite owner:', (i as any).owner, 'Current user:', currentSub, 'Matches:', matches);
          return matches;
        })
        .filter(i => !(i as any).userHidden)
        .sort((a: any, b: any) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
      console.log('Filtered seminar invites:', list);
      setMyInvites(list);
    } catch (e) {
      console.error('Failed to fetch seminar invites', e);
    } finally {
      setInvitesLoading(false);
    }
  }, [client, currentSub]);

  // Always load notifications and invites on mount (and when user/admin status changes)
  React.useEffect(() => {
    if (isAdmin) {
      fetchPending();
      fetchMyInvites();
    } else if (currentSub) {
      fetchMyRequests();
      fetchMyInvites();
    }
    // Optionally, add a timer for polling if you want live updates
    // const interval = setInterval(() => { ... }, 60000);
    // return () => clearInterval(interval);
  }, [isAdmin, currentSub, fetchPending, fetchMyRequests, fetchMyInvites]);

  const markAllRead = async () => {
    try {
      await Promise.all(myRequests.map(r => client.models.LeaveRequest.update({ id: r.id, userRead: true as any })));
      setMyRequests(reqs => reqs.map(r => ({ ...r, userRead: true } as any)));
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const hideOne = async (id: string) => {
    try {
      await client.models.LeaveRequest.update({ id, userHidden: true as any });
      setMyRequests(reqs => reqs.filter(r => r.id !== id));
    } catch (e) {
      console.error('Failed to hide notification', e);
    }
  };

  const hideAll = async () => {
    try {
      await Promise.all(myRequests.map(r => client.models.LeaveRequest.update({ id: r.id, userHidden: true as any })));
      setMyRequests([]);
    } catch (e) {
      console.error('Failed to hide all notifications', e);
    }
  };

  // Admin inbox helpers for seminar invites: mark all as read / hide all
  const markAllAdminInvitesRead = async () => {
    try {
      await Promise.all(myInvites.map(inv => (client.models.SeminarInvite.update as any)({ id: inv.id, userRead: true as any })));
      setMyInvites(list => list.map(i => ({ ...i, userRead: true } as any)));
    } catch (e) {
      console.error('Failed to mark admin invites read', e);
    }
  };

  const hideAllAdminInvites = async () => {
    try {
      await Promise.all(myInvites.map(inv => (client.models.SeminarInvite.update as any)({ id: inv.id, userHidden: true as any })));
      setMyInvites([]);
    } catch (e) {
      console.error('Failed to hide admin invites', e);
    }
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // removed old toggleDrawer wrapper to avoid unused function

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    router.push('/profile');
    handleClose();
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/signin');
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
    } finally {
      handleClose();
    }
  };

  return (
    <>
    <Box sx={{
      background: "#fff",
      display: "flex",
      alignItems: "center",
  // Move content slightly away from the right edge so the profile menu can center below the avatar
  padding: { xs: "0 24px", md: "0 48px" },
      height: 72,
  boxShadow: "0 2px 8px #f0f1f2",
  position: 'sticky',
  top: 0,
  zIndex: 1100
    }}>
      <IconButton
        size="large"
        edge="start"
        color="inherit"
        aria-label="menu"
        sx={{ mr: 2 }}
        onClick={() => setDrawerOpen(true)}
      >
        <MenuIcon />
      </IconButton>
      <CRADrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        submittedMonths={submittedMonths}
        onMonthSelect={(index:number) => {
          const ym = `${currentYear}-${String(index + 1).padStart(2,'0')}`;
          setMonthString(ym);
          router.push(`/cra/${ym}?user=me`);
        }}
  monthStatusMap={monthStatusMap}
  monthLockedMap={monthLockedMap}
      />
      <Image
        src="/logo/logo_sans_ecriture.png"
        alt="Logo Decision Network"
        width={48}
        height={48}
        style={{ objectFit: "contain", cursor: "pointer" }}
        onClick={() => router.push('/')}
      />
  {/* Horizontal links */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        gap: 3,
        ml: 5
      }}>
        {(
          // If admin, show Administration first
          isAdmin
            ? [
                { label: 'Administration', href: '/admin' },
                { label: 'Calendrier', href: '/calendrier' },
                { label: 'Salariés', href: '/salaries' },
                { label: 'Congés', href: '/conges' },
                { label: 'Séminaires', href: '/seminaires' },
              ]
            : [
                { label: 'Calendrier', href: '/calendrier' },
                { label: 'Salariés', href: '/salaries' },
                { label: 'Congés', href: '/conges' },
                { label: 'Séminaires', href: '/seminaires' },
              ]
        ).map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Box
              key={item.href}
              role="link"
              tabIndex={0}
              onClick={() => router.push(item.href)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(item.href); }}
              sx={{
                cursor: 'pointer',
                color: active ? '#111' : '#6b7280',
                fontWeight: 600,
                fontSize: 14,
                px: 0.5,
                pb: 1,
                borderBottom: active ? '2px solid #894991' : '2px solid transparent',
                transition: 'color .2s ease, border-color .2s ease',
                '&:hover': { color: '#111', borderBottomColor: '#e5e7eb' }
              }}
            >
              {item.label}
            </Box>
          );
        })}
  </Box>
      <Box sx={{ flex: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: { xs: 2, md: 3 } }}>
  {/* User inbox (non-admins) */}
  {!isAdmin && (
    <>
    <IconButton
            onClick={(e) => {
              setUserInboxAnchor(e.currentTarget);
              fetchMyRequests();
              fetchMyInvites();
            }}
            aria-label="Mes notifications"
            sx={{
              p: 0.75,
              borderRadius: '12px',
              background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
              border: '1px solid #e5e7eb',
              color: '#334155'
            }}
          >
            <Badge
              badgeContent={
                myRequests.filter(r => (r as any).status !== 'pending' && !(r as any).userRead).length +
                myInvites.filter(i => !(i as any).userRead).length
              }
              color="primary"
              invisible={(myRequests.length + myInvites.length) === 0}
            >
              <MailOutlineIcon sx={{ fontSize: 20 }} />
            </Badge>
          </IconButton>
    <Popover
          open={Boolean(userInboxAnchor)}
          anchorEl={userInboxAnchor}
          onClose={() => setUserInboxAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          disableScrollLock
          PaperProps={{ sx: { p: 0, width: 420, borderRadius: 2, overflow: 'hidden', border: '1px solid #eee' } }}
        >
          <MuiBox sx={{ px: 2, py: 1.25, borderBottom: '1px solid #eee', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <Typography sx={{ fontWeight: 800 }}>Mes notifications</Typography>
            <Button size="small" variant="outlined" onClick={markAllRead} sx={{ textTransform:'none', borderColor:'#d1d5db', color:'#374151' }}>Tout marquer comme lu</Button>
          </MuiBox>
          <MuiBox sx={{ p: 1.5 }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: .4, color: '#666', fontWeight: 700 }}>Mes invitations de séminaire</Typography>
            <Divider sx={{ my: 1 }} />
            {invitesLoading ? (
              <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'center', py: 3 }}>
                <CircularProgress size={22} />
              </MuiBox>
            ) : myInvites.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#777' }}>Aucune invitation</Typography>
            ) : (
              myInvites.map((inv) => (
                <MuiBox key={inv.id} sx={{ py: 1.25, px: 1, borderRadius: 1.25, border: '1px solid #eee', mb: 1 }}>
                  <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 1 }}>
                    <MuiBox>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{inv.startDate} → {inv.endDate}</Typography>
                      <Chip size="small" label={(inv as any).status} sx={{ mt: 0.5 }} color={(inv as any).status === 'accepted' ? 'success' : (inv as any).status === 'refused' ? 'error' : 'default'} />
                      {(inv as any).location && (
                        <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                          <strong>Lieu:</strong> {(inv as any).location}
                        </Typography>
                      )}
                      {(inv as any).activities && (
                        <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                          <strong>Activités:</strong> {(inv as any).activities}
                        </Typography>
                      )}
                      {(inv as any).details && (
                        <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                          <strong>Détails:</strong> {(inv as any).details}
                        </Typography>
                      )}
                      {(inv as any).message && (
                        <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                          {(inv as any).message}
                        </Typography>
                      )}
                    </MuiBox>
                    {(inv as any).status !== 'pending' ? (
                      <Button size="small" variant="text" color="error" onClick={async () => {
                        try { await (client.models.SeminarInvite.update as any)({ id: inv.id, userHidden: true as any }); setMyInvites(cur => cur.filter(i => i.id !== inv.id)); } catch {}
                      }} sx={{ textTransform:'none' }}>Supprimer</Button>
                    ) : null}
                  </MuiBox>
                  {(inv as any).status === 'pending' && (
                    <MuiBox sx={{ display:'flex', gap: 1, mt: 0.75 }}>
                      <Button
                        size="small"
                        color="success"
                        variant="outlined"
                        disabled={inviteActionLoading[inv.id] != null}
                        onClick={async () => {
                          setInviteActionLoading(prev => ({ ...prev, [inv.id]: 'accepted' }));
                          try {
                            await (client.models.SeminarInvite.update as any)({ id: inv.id, status: 'accepted' as any, userRead: true as any });
                            await applySeminarToCra(currentSub as string, inv.startDate, inv.endDate);
                            setMyInvites(list => list.map(i => i.id === inv.id ? ({ ...i, status: 'accepted' } as any) : i));
                          } finally {
                            setInviteActionLoading(prev => { const { [inv.id]:_, ...rest } = prev; return rest; });
                          }
                        }}
                        sx={{ minWidth: 0, px: 1.25, py: 0.25 }}
                      >
                        {inviteActionLoading[inv.id] === 'accepted' ? <CircularProgress size={14} sx={{ mx: 0.5 }} /> : 'Accepter'}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        disabled={inviteActionLoading[inv.id] != null}
                        onClick={() => setRefuseDialog({ open: true, inviteId: inv.id, reason: '' })}
                        sx={{ minWidth: 0, px: 1.25, py: 0.25 }}
                      >
                        {inviteActionLoading[inv.id] === 'refused' ? <CircularProgress size={14} sx={{ mx: 0.5 }} /> : 'Refuser'}
                      </Button>
                    </MuiBox>
                  )}
                </MuiBox>
              ))
            )}

            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: .4, color: '#666', fontWeight: 700, mt: 1.5, display:'block' }}>Mes demandes de congés</Typography>
            <Divider sx={{ my: 1 }} />
            {userInboxLoading ? (
              <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'center', py: 3 }}>
                <CircularProgress size={22} />
              </MuiBox>
            ) : myRequests.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#777' }}>Aucune demande pour l'instant</Typography>
            ) : (
              myRequests.map((r) => (
                <MuiBox key={r.id} sx={{ py: 1.25, px: 1, borderRadius: 1.25, border: '1px solid #eee', mb: 1 }}>
                  <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 1 }}>
                    <MuiBox>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{r.startDate} → {r.endDate}</Typography>
                      <Chip size="small" label={(r as any).status} sx={{ mt: 0.5 }} color={(r as any).status === 'approuvee' ? 'success' : (r as any).status === 'refusee' ? 'error' : 'default'} />
                      {(r as any).adminNote && (
                        <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                          Message: {(r as any).adminNote}
                        </Typography>
                      )}
                    </MuiBox>
                    <Button size="small" variant="text" color="error" onClick={() => hideOne(r.id)} sx={{ textTransform:'none' }}>Supprimer</Button>
                  </MuiBox>
                </MuiBox>
              ))
            )}
          </MuiBox>
        </Popover>
    </>
  )}
        {isAdmin && (
          <>
            <IconButton
              onClick={(e) => { openInbox(e as any); fetchMyInvites(); }}
              aria-label="Demandes de congés"
              sx={{
                p: 0.75,
                borderRadius: '12px',
                background: 'linear-gradient(180deg, #faf5fc 0%, #f3e8f6 100%)',
                border: '1px solid #e7cdef',
                boxShadow: '0 6px 16px rgba(137,73,145,0.12)',
                color: '#894991',
                transition: 'all .18s ease',
                '&:hover': {
                  background: 'linear-gradient(180deg, #f8effa 0%, #ecdff1 100%)',
                  boxShadow: '0 10px 22px rgba(137,73,145,0.18)'
                }
              }}
            >
              <Badge
                badgeContent={pendingCount + myInvites.filter(i => !(i as any).userRead).length}
                color="error"
                invisible={(pendingCount + myInvites.length) === 0}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: '#e11d48',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 18,
                    height: 18,
                    border: '1px solid #fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
                  }
                }}
              >
                <MailOutlineIcon sx={{ fontSize: 20 }} />
              </Badge>
            </IconButton>
            <Popover
              open={Boolean(inboxAnchor)}
              anchorEl={inboxAnchor}
              onClose={closeInbox}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              disableScrollLock
              PaperProps={{
                sx: {
                  p: 0,
                  width: 420,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid #eee',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.14)'
                }
              }}
            >
              <MuiBox sx={{
                px: 2,
                py: 1.25,
                background: 'linear-gradient(180deg, #faf5fc 0%, #f3e8f6 100%)',
                borderBottom: '1px solid #e7cdef',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <Typography sx={{ fontWeight: 800, color: '#6a3a7a' }}>Notifications</Typography>
                <Chip size="small" label={`${pendingCount}`} sx={{
                  height: 22,
                  '& .MuiChip-label': { px: 0.75, fontWeight: 700, fontSize: 12 },
                  backgroundColor: '#894991',
                  color: '#fff'
                }} />
              </MuiBox>
              <MuiBox sx={{ p: 1.5 }}>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: .4, color: '#8b5a94', fontWeight: 700 }}>Invitations de séminaire</Typography>
                <Divider sx={{ my: 1 }} />
                <MuiBox sx={{ display:'flex', gap: 1, mb: 1 }}>
                  <Button size="small" variant="outlined" onClick={markAllAdminInvitesRead} sx={{ textTransform:'none', borderColor:'#d1d5db', color:'#374151' }}>Tout marquer comme lu</Button>
                  <Button size="small" variant="text" color="error" onClick={hideAllAdminInvites} sx={{ textTransform:'none' }}>Tout supprimer</Button>
                </MuiBox>
                {invitesLoading ? (
                  <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'center', py: 3 }}>
                    <CircularProgress size={22} />
                  </MuiBox>
                ) : myInvites.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#777' }}>Aucune invitation</Typography>
                ) : (
                  myInvites.map((inv) => (
                    <MuiBox key={inv.id} sx={{ py: 1.25, px: 1, borderRadius: 1.25, border: '1px solid #eee', mb: 1 }}>
                      <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 1 }}>
                        <MuiBox>
                          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{inv.startDate} → {inv.endDate}</Typography>
                          <Chip size="small" label={(inv as any).status} sx={{ mt: 0.5 }} color={(inv as any).status === 'accepted' ? 'success' : (inv as any).status === 'refused' ? 'error' : 'default'} />
                          {(inv as any).location && (
                            <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                              <strong>Lieu:</strong> {(inv as any).location}
                            </Typography>
                          )}
                          {(inv as any).activities && (
                            <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                              <strong>Activités:</strong> {(inv as any).activities}
                            </Typography>
                          )}
                          {(inv as any).details && (
                            <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                              <strong>Détails:</strong> {(inv as any).details}
                            </Typography>
                          )}
                          {(inv as any).message && (
                            <Typography variant="body2" sx={{ color:'#555', mt: 0.5 }}>
                              {(inv as any).message}
                            </Typography>
                          )}
                        </MuiBox>
                        {(inv as any).status !== 'pending' ? (
                          <Button size="small" variant="text" color="error" onClick={async () => {
                            try { await (client.models.SeminarInvite.update as any)({ id: inv.id, userHidden: true as any }); setMyInvites(cur => cur.filter(i => i.id !== inv.id)); } catch {}
                          }} sx={{ textTransform:'none' }}>Supprimer</Button>
                        ) : (
                          <MuiBox sx={{ display:'flex', gap: 1 }}>
                            <Button
                              size="small"
                              color="success"
                              variant="outlined"
                              disabled={inviteActionLoading[inv.id] != null}
                              onClick={async () => {
                                setInviteActionLoading(prev => ({ ...prev, [inv.id]: 'accepted' }));
                                try {
                                  await (client.models.SeminarInvite.update as any)({ id: inv.id, status: 'accepted' as any, userRead: true as any });
                                  await applySeminarToCra(currentSub as string, inv.startDate, inv.endDate);
                                  setMyInvites(list => list.map(i => i.id === inv.id ? ({ ...i, status: 'accepted' } as any) : i));
                                } finally {
                                  setInviteActionLoading(prev => { const { [inv.id]:_, ...rest } = prev; return rest; });
                                }
                              }}
                              sx={{ minWidth: 0, px: 1.25, py: 0.25 }}
                            >
                              {inviteActionLoading[inv.id] === 'accepted' ? <CircularProgress size={14} sx={{ mx: 0.5 }} /> : 'Accepter'}
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              disabled={inviteActionLoading[inv.id] != null}
                              onClick={() => setRefuseDialog({ open: true, inviteId: inv.id, reason: '' })}
                              sx={{ minWidth: 0, px: 1.25, py: 0.25 }}
                            >
                              {inviteActionLoading[inv.id] === 'refused' ? <CircularProgress size={14} sx={{ mx: 0.5 }} /> : 'Refuser'}
                            </Button>
                          </MuiBox>
                        )}
                      </MuiBox>
                    </MuiBox>
                  ))
                )}

                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: .4, color: '#8b5a94', fontWeight: 700, mt: 1.5, display:'block' }}>Congés</Typography>
                <Divider sx={{ my: 1 }} />
                {adminInboxLoading ? (
                  <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'center', py: 3 }}>
                    <CircularProgress size={22} />
                  </MuiBox>
                ) : pendingList.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#777' }}>Aucune nouvelle demande</Typography>
                ) : (
                  pendingList.map((r) => (
                    <MuiBox key={r.id} sx={{ py: 1 }}>
                      <MuiBox sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 1 }}>
                        <MuiBox sx={{ display:'flex', alignItems:'center', gap: 1 }}>
                          <MuiBox sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '10px',
                            display: 'grid',
                            placeItems: 'center',
                            background: '#f4e9f6',
                            border: '1px solid #e7dff0',
                            color: '#6a3a7a'
                          }}>
                            <EventAvailableOutlinedIcon sx={{ fontSize: 18 }} />
                          </MuiBox>
                          <MuiBox>
                            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                              {fullName((r as any).owner)}
                            </Typography>
                            <Typography sx={{ fontWeight: 500, fontSize: 13, color:'#333' }}>{r.startDate} → {r.endDate}</Typography>
                            {r.reason && <Typography variant="body2" sx={{ color:'#666' }}>{r.reason}</Typography>}
                          </MuiBox>
                        </MuiBox>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => { closeInbox(); router.push(`/admin/absences?request=${r.id}`); }}
                          sx={{ textTransform:'none', color:'#894991' }}
                        >
                          Voir plus
                        </Button>
                      </MuiBox>
                      <MuiBox sx={{ display:'flex', gap: 1, pl: 5.5, mt: 0.75 }}>
                        <Button
                          size="small"
                          color="success"
                          variant="outlined"
                          disabled={actionLoading[r.id] != null}
                          onClick={async () => {
                            setActionLoading(prev => ({ ...prev, [r.id]: 'approuvee' }));
                            try {
                              await updateStatus(r.id, 'approuvee', undefined, (r as any).owner, { startDate: r.startDate, endDate: r.endDate, reason: (r as any).reason });
                            } finally {
                              setActionLoading(prev => { const { [r.id]: _, ...rest } = prev; return rest; });
                            }
                          }}
                          sx={{ minWidth: 0, px: 1.25, py: 0.25 }}
                        >
                          {actionLoading[r.id] === 'approuvee' ? <CircularProgress size={14} sx={{ mx: 0.5 }} /> : 'Accepter'}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          disabled={actionLoading[r.id] != null}
                          onClick={async () => {
                            setActionLoading(prev => ({ ...prev, [r.id]: 'refusee' }));
                            try {
                              await updateStatus(r.id, 'refusee', undefined, (r as any).owner, { startDate: r.startDate, endDate: r.endDate, reason: (r as any).reason });
                            } finally {
                              setActionLoading(prev => { const { [r.id]: _, ...rest } = prev; return rest; });
                            }
                          }}
                          sx={{ minWidth: 0, px: 1.25, py: 0.25 }}
                        >
                          {actionLoading[r.id] === 'refusee' ? <CircularProgress size={14} sx={{ mx: 0.5 }} /> : 'Refuser'}
                        </Button>
                      </MuiBox>
                    </MuiBox>
                  ))
                )}
              </MuiBox>
            </Popover>
          </>
        )}
        {isAdmin && (
          <Tooltip title="Vous êtes administrateur" arrow>
            <Box
              aria-hidden
              sx={{
                width: 30,
                height: 30,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                background: 'linear-gradient(180deg, #faf5fc 0%, #f3e8f6 100%)',
                border: '1px solid #e7cdef',
                boxShadow: '0 3px 10px rgba(137,73,145,0.18)',
                color: '#894991',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 18px rgba(137,73,145,0.25)'
                }
              }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
        )}
        <IconButton
          size="large"
          aria-label="account of current user"
          aria-controls="menu-appbar"
          aria-haspopup="true"
          onClick={handleMenu}
          color="inherit"
          sx={{ p: 0.5, borderRadius: '999px' }}
        >
          <Box
            sx={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              transition: 'transform .2s ease',
              '&:hover .avatar-img': {
                transform: 'scale(1.06)',
                boxShadow: '0 8px 24px rgba(137,73,145,.35)'
              },
              '&:hover .avatar-ring': {
                opacity: 1,
                transform: 'scale(1)'
              },
              '&:focus-within .avatar-ring': {
                opacity: 1,
                transform: 'scale(1)'
              }
            }}
          >
            <Avatar
              src={avatarUrl}
              className="avatar-img"
              sx={{
                bgcolor: '#894991',
                width: 40,
                height: 40,
                transition: 'transform .2s ease, box-shadow .25s ease'
              }}
            />
            <Box
              className="avatar-ring"
              sx={{
                position: 'absolute',
                inset: -3,
                borderRadius: '50%',
                border: '2px solid #894991',
                opacity: 0,
                transform: 'scale(.9)',
                transition: 'opacity .25s ease, transform .25s ease',
                pointerEvents: 'none'
              }}
            />
          </Box>
        </IconButton>
  <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          keepMounted
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          disableScrollLock
          TransitionComponent={Grow}
          TransitionProps={{ style: { transformOrigin: 'top center' } }}
          PaperProps={{
            sx: {
              mt: 1.25,
              overflow: 'visible',
              borderRadius: 1.5,
              boxShadow: '0px 10px 25px rgba(0,0,0,0.12)',
              border: '1px solid #eee',
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                borderLeft: '1px solid #eee',
                borderTop: '1px solid #eee',
                top: 0,
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)'
              }
            }
          }}
          open={open}
          onClose={handleClose}
        >
          <MenuItem onClick={handleProfile}>Profil</MenuItem>
          <MenuItem onClick={handleLogout}>Déconnexion</MenuItem>
        </Menu>
      </Box>
    </Box>
      {/* Refuse seminar dialog */}
      <Dialog
        open={refuseDialog.open}
        onClose={() => setRefuseDialog({ open: false, inviteId: '', reason: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Refuser l'invitation au séminaire</DialogTitle>
        <DialogContent>
          <TextField
            label="Justification (optionnel)"
            value={refuseDialog.reason}
            onChange={(e) => setRefuseDialog(prev => ({ ...prev, reason: e.target.value }))}
            multiline
            rows={3}
            fullWidth
            margin="normal"
            placeholder="Veuillez indiquer la raison de votre refus..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefuseDialog({ open: false, inviteId: '', reason: '' })}>
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              const { inviteId, reason } = refuseDialog;
              setInviteActionLoading(prev => ({ ...prev, [inviteId]: 'refused' }));
              try {
                await (client.models.SeminarInvite.update as any)({
                  id: inviteId,
                  status: 'refused' as any,
                  refuseReason: reason,
                  userRead: true as any
                });
                setMyInvites(list => list.map(i => i.id === inviteId ? ({ ...i, status: 'refused', refuseReason: reason } as any) : i));
                setRefuseDialog({ open: false, inviteId: '', reason: '' });
              } finally {
                setInviteActionLoading(prev => { const { [inviteId]:_, ...rest } = prev; return rest; });
              }
            }}
          >
            Confirmer le refus
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Details dialog */}
      <Dialog open={detailsOpen} onClose={closeDetails} fullWidth maxWidth="sm">
        <DialogTitle>Détails de la demande</DialogTitle>
        <DialogContent dividers>
          {selectedReq && (
            <MuiBox sx={{ display:'flex', flexDirection:'column', gap: 1 }}>
              <Typography><strong>Demandeur:</strong> {fullName((selectedReq as any).owner)}</Typography>
              <Typography><strong>Période:</strong> {selectedReq.startDate} → {selectedReq.endDate}</Typography>
              {selectedReq.reason && <Typography><strong>Motif (utilisateur):</strong> {selectedReq.reason}</Typography>}
              <TextField
                label="Motif (optionnel) communiqué à l'utilisateur"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                multiline
                minRows={3}
                fullWidth
              />
            </MuiBox>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetails} disabled={!!detailsLoading}>Annuler</Button>
          <Button color="error" variant="outlined" onClick={handleRejectWithNote} disabled={detailsLoading!=null}>
            {detailsLoading === 'refusee' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Refuser
          </Button>
          <Button color="success" variant="contained" onClick={handleApproveWithNote} disabled={detailsLoading!=null}>
            {detailsLoading === 'approuvee' ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Accepter
          </Button>
        </DialogActions>
      </Dialog>
  </>
  );
}