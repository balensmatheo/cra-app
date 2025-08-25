"use client";

import React, { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Stack,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  Divider,
  IconButton,
} from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { applySeminarToCra, removeSeminarFromCra } from "@/utils/craSync";

const client = generateClient<Schema>();

type Invite = Schema["SeminarInvite"]["type"];

type SeminarGroup = {
  key: string; // start_end
  startDate: string;
  endDate: string;
  title?: string;
  location?: string;
  activities?: string;
  details?: string;
  imageUrl?: string;
  totalInvites: number;
  acceptedCount: number;
  refusedCount: number;
  pendingCount: number;
  invites: Array<{ id: string; owner: string; status: "pending" | "accepted" | "refused" }>;
};

export default function AdminSeminairesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Form state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [activities, setActivities] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");

  // Data state
  const [groups, setGroups] = useState<SeminarGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SeminarGroup | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Bulk apply dialog (optional admin action to force-apply for all accepted? Not required by spec)
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<SeminarGroup | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchAuthSession();
        const groups = (s.tokens?.idToken?.payload["cognito:groups"] as string[]) || [];
        setIsAdmin(groups.includes("ADMINS"));
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadGroups();
    }
  }, [isAdmin]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data } = await (client.models.SeminarInvite.list as any)({});
      const invites = (data || []) as any[];

      const byKey: Record<string, any[]> = {};
      for (const inv of invites) {
        const key = `${inv.startDate}_${inv.endDate}`;
        (byKey[key] ||= []).push(inv);
      }

      const gs: SeminarGroup[] = Object.entries(byKey).map(([key, invs]) => {
        const [sd, ed] = key.split("_");
        const first = invs[0] || {};
        return {
          key,
          startDate: sd,
          endDate: ed,
          title: first.title,
          location: first.location,
          activities: first.activities,
          details: first.details,
          imageUrl: first.imageUrl,
          totalInvites: invs.length,
          acceptedCount: invs.filter((i) => i.status === "accepted").length,
          refusedCount: invs.filter((i) => i.status === "refused").length,
          pendingCount: invs.filter((i) => i.status === "pending").length,
          invites: invs.map((i) => ({ id: i.id, owner: i.owner, status: i.status || "pending" })),
        };
      });

      // Sort desc by startDate
      gs.sort((a, b) => b.startDate.localeCompare(a.startDate));
      setGroups(gs);
    } catch {
      setSnackbar({ open: true, message: "Échec de chargement des séminaires", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!startDate || !endDate) return "Veuillez renseigner les dates.";
    if (endDate < startDate) return "La date de fin doit être postérieure ou égale à la date de début.";
    return null;
  };

  const onCreateSeminar = async () => {
    const err = validateForm();
    if (err) {
      setSnackbar({ open: true, message: err, severity: "error" });
      return;
    }
    setCreating(true);
    try {
      // Get all users (USERS + ADMINS)
      const { data, errors } = await client.queries.listUsers({});
      if (errors && errors.length) throw new Error(errors[0].message || "listUsers error");
      const payload = typeof data === "string" ? JSON.parse(data as any) : (data as any);
      const users = (payload?.users || []) as Array<{ username: string; groups?: string[] }>;

      // Idempotence: skip users already invited for this date range
      const existing = await (client.models.SeminarInvite.list as any)({
        filter: { startDate: { eq: startDate }, endDate: { eq: endDate } },
      });
      const alreadyOwners = new Set<string>(((existing?.data || []) as any[]).map((i) => String(i.owner)));

      let createdCount = 0;
      for (const u of users) {
        const sub = u.username;
        if (!sub) continue;
        if (alreadyOwners.has(sub)) continue;
        try {
          await client.models.SeminarInvite.create({
            startDate: startDate,
            endDate: endDate,
            owner: sub as any,
            status: 'pending' as any,
            userRead: false as any,
            userHidden: false as any,
            // Optional metadata: use null instead of undefined for Nullable fields
            title: (title && title.trim().length > 0) ? title : null,
            location: (location && location.trim().length > 0) ? location : null,
            activities: (activities && activities.trim().length > 0) ? activities : null,
            details: (details && details.trim().length > 0) ? details : null,
            imageUrl: (imageUrl && imageUrl.trim().length > 0) ? imageUrl : null,
          } as any);
          createdCount++;
        } catch {
          // skip individual failures
        }
      }

      setSnackbar({
        open: true,
        message:
          createdCount > 0
            ? `Séminaire créé: ${createdCount} invitation(s) envoyée(s)`
            : `Aucune nouvelle invitation (déjà invité pour cette période)`,
        severity: "success",
      });

      // Reset form
      // keep title/metadata for convenience
      // setTitle(""); setLocation(""); setActivities(""); setDetails(""); setImageUrl("");
      await loadGroups();
    } catch {
      setSnackbar({ open: true, message: "Échec de la création/invitation", severity: "error" });
    } finally {
      setCreating(false);
    }
  };

  // Delete a seminar group: delete invites and clean CRA entries for users who had accepted
  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const { startDate: sd, endDate: ed } = deleteTarget;

      // Fetch all invites again for this group for safety
      const { data } = await (client.models.SeminarInvite.list as any)({
        filter: { startDate: { eq: sd }, endDate: { eq: ed } },
      });
      const invs = (data || []) as any[];

      // Remove CRA entries only for accepted users
      for (const inv of invs) {
        if (String(inv.status) === "accepted" && inv.owner) {
          try {
            await removeSeminarFromCra(client as any, String(inv.owner), sd, ed);
          } catch {
            // ignore individual removal errors
          }
        }
      }

      // Delete all invites for this group
      await Promise.allSettled(invs.map((i) => client.models.SeminarInvite.delete({ id: i.id })));

      setSnackbar({ open: true, message: "Séminaire supprimé et CRA nettoyés pour les participants", severity: "success" });
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadGroups();
    } catch {
      setSnackbar({ open: true, message: "Échec de la suppression du séminaire", severity: "error" });
    } finally {
      setDeleteBusy(false);
    }
  };

  // Optional: force apply CRA entries for all currently accepted (to re-sync)
  const onConfirmApply = async () => {
    if (!applyTarget) return;
    setApplyBusy(true);
    try {
      const { startDate: sd, endDate: ed, title } = applyTarget;

      // Fetch all invites for this group
      const { data } = await (client.models.SeminarInvite.list as any)({
        filter: { startDate: { eq: sd }, endDate: { eq: ed } },
      });
      const invs = (data || []) as any[];

      for (const inv of invs) {
        if (String(inv.status) === "accepted" && inv.owner) {
          try {
            await applySeminarToCra(client as any, String(inv.owner), sd, ed, title);
          } catch {
            // ignore individual apply errors
          }
        }
      }

      setSnackbar({ open: true, message: "Ré-application CRA terminée pour les participants", severity: "success" });
      setApplyOpen(false);
      setApplyTarget(null);
    } catch {
      setSnackbar({ open: true, message: "Échec de l’opération", severity: "error" });
    } finally {
      setApplyBusy(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = useMemo(() => groups.filter((g) => g.startDate >= today), [groups, today]);
  const past = useMemo(() => groups.filter((g) => g.startDate < today), [groups, today]);

  if (isAdmin === null) return <Box sx={{ p: 4 }}><Typography>Chargement…</Typography></Box>;
  if (!isAdmin) return <Box sx={{ p: 4 }}><Typography color="error">Accès refusé</Typography></Box>;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: "#894991", mb: 3 }}>
        Administration — Séminaires
      </Typography>

      {/* Create seminar form */}
      <Card elevation={0} sx={{ border: "1px solid #eee", mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Créer un séminaire et inviter tout le monde</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Date de début"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Date de fin"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Titre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                size="small"
                placeholder="Séminaire annuel"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Lieu"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                fullWidth
                size="small"
                placeholder="Paris, siège social"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Activités"
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
                fullWidth
                size="small"
                placeholder="Ateliers, conférences, team-building"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Détails"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Image (URL HTTP ou clé S3)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                fullWidth
                size="small"
                placeholder="https://… ou public/seminaire.jpg"
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<GroupAddOutlinedIcon />}
              onClick={onCreateSeminar}
              disabled={creating}
              sx={{ textTransform: "none", background: "#894991", "&:hover": { background: "#6a3a7a" } }}
            >
              {creating ? "Création…" : "Créer et inviter"}
            </Button>
            <Tooltip title="Tous les utilisateurs (USERS et ADMINS) recevront une invitation 'pending'. Les duplicats sur la même période sont évités.">
              <InfoOutlinedIcon sx={{ color: "#999", mt: "6px" }} fontSize="small" />
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      {/* Upcoming */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>À venir</Typography>
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {loading && (
          <Grid item xs={12}><Typography sx={{ color: "#666" }}>Chargement…</Typography></Grid>
        )}
        {!loading && upcoming.length === 0 && (
          <Grid item xs={12}><Typography sx={{ color: "#777" }}>Aucun séminaire à venir.</Typography></Grid>
        )}
        {upcoming.map(renderGroupCard)}
      </Grid>

      <Divider sx={{ my: 2 }} />

      {/* Past */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Historique</Typography>
      <Grid container spacing={1.5}>
        {!loading && past.length === 0 && (
          <Grid item xs={12}><Typography sx={{ color: "#777" }}>Aucun séminaire passé.</Typography></Grid>
        )}
        {past.map(renderGroupCard)}
      </Grid>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onClose={() => !deleteBusy && setDeleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Supprimer le séminaire</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Confirmez-vous la suppression de ce séminaire ? Toutes les invitations seront supprimées.
            Les écritures CRA [SEMINAIRE] seront retirées uniquement pour les utilisateurs ayant accepté.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>Annuler</Button>
          <Button color="error" variant="contained" onClick={onConfirmDelete} disabled={deleteBusy}>
            {deleteBusy ? "Suppression…" : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply dialog (optional maintenance) */}
      <Dialog open={applyOpen} onClose={() => !applyBusy && setApplyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ré-appliquer au CRA</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Cette opération va ré-appliquer 1.0 [SEMINAIRE] sur chaque jour ouvré pour tous les utilisateurs ayant accepté.
            Utile si une désynchronisation a été détectée.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyOpen(false)} disabled={applyBusy}>Annuler</Button>
          <Button variant="contained" onClick={onConfirmApply} disabled={applyBusy}>
            {applyBusy ? "Application…" : "Ré-appliquer"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );

  function renderGroupCard(g: SeminarGroup) {
    return (
      <Grid item xs={12} md={6} key={g.key}>
        <Card elevation={0} sx={{ border: "1px solid #eee", borderLeft: "4px solid #894991" }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarMonthOutlinedIcon fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {formatRangeFr(g.startDate, g.endDate)}
                  </Typography>
                </Stack>
                {g.title && (
                  <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                    {g.title}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "#444" }}>
                  {g.location && (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <PlaceOutlinedIcon fontSize="small" />
                      <Typography variant="body2">{g.location}</Typography>
                    </Stack>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Tooltip title="Invitations en attente">
                    <Chip
                      size="small"
                      variant="outlined"
                      color="warning"
                      icon={<HourglassEmptyIcon sx={{ fontSize: 16 }} />}
                      label={`${g.pendingCount} en attente`}
                    />
                  </Tooltip>
                  <Tooltip title="Participations confirmées">
                    <Chip
                      size="small"
                      variant="outlined"
                      color="success"
                      icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      label={`${g.acceptedCount} confirmées`}
                    />
                  </Tooltip>
                  <Tooltip title="Participations refusées">
                    <Chip
                      size="small"
                      variant="outlined"
                      color="default"
                      icon={<CancelIcon sx={{ fontSize: 16 }} />}
                      label={`${g.refusedCount} refusées`}
                    />
                  </Tooltip>
                  <Chip size="small" variant="outlined" label={`${g.totalInvites} invités`} />
                </Stack>
                {g.activities && (
                  <Typography variant="body2" sx={{ color: "#333", mt: 1 }}>
                    <strong>Activités: </strong>
                    {g.activities}
                  </Typography>
                )}
                {g.details && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#666",
                      mt: 0.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.details}
                  </Typography>
                )}
              </Stack>
              <Stack spacing={1} alignItems="flex-end">
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<GroupAddOutlinedIcon />}
                  onClick={async () => {
                    // Re-invite missing users only (idempotent top-up)
                    try {
                      const { data, errors } = await client.queries.listUsers({});
                      if (errors && errors.length) throw new Error(errors[0].message || "listUsers error");
                      const payload = typeof data === "string" ? JSON.parse(data as any) : (data as any);
                      const users = (payload?.users || []) as Array<{ username: string }>;

                      const { data: existing } = await (client.models.SeminarInvite.list as any)({
                        filter: { startDate: { eq: g.startDate }, endDate: { eq: g.endDate } },
                      });
                      const exists = new Set<string>(((existing || []) as any[]).map((i) => String(i.owner)));

                      let created = 0;
                      for (const u of users) {
                        const sub = u.username;
                        if (!sub || exists.has(sub)) continue;
                        try {
                          await client.models.SeminarInvite.create({
                            startDate: g.startDate,
                            endDate: g.endDate,
                            owner: sub as any,
                            status: "pending" as any,
                            userRead: false as any,
                            userHidden: false as any,
                            // Normalize nullable fields to null (not undefined)
                            title: g.title ?? null,
                            location: g.location ?? null,
                            activities: g.activities ?? null,
                            details: g.details ?? null,
                            imageUrl: g.imageUrl ?? null,
                          } as any);
                          created++;
                        } catch {
                          // noop
                        }
                      }
                      setSnackbar({
                        open: true,
                        message: created > 0 ? `Invitations ajoutées: ${created}` : "Aucune nouvelle invitation",
                        severity: "success",
                      });
                      await loadGroups();
                    } catch {
                      setSnackbar({ open: true, message: "Échec de l’action", severity: "error" });
                    }
                  }}
                  sx={{ textTransform: "none", background: "#894991", "&:hover": { background: "#6a3a7a" } }}
                >
                  Compléter les invitations
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setApplyTarget(g);
                      setApplyOpen(true);
                    }}
                    sx={{ textTransform: "none" }}
                  >
                    Ré-appliquer CRA (acceptés)
                  </Button>
                  <Tooltip title="Supprimer toutes les invitations; retire les écritures [SEMINAIRE] pour les participants ayant accepté.">
                    <span>
                      <IconButton
                        color="error"
                        onClick={() => {
                          setDeleteTarget(g);
                          setDeleteOpen(true);
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    );
  }
}

function formatDateFr(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
}
function formatRangeFr(a: string, b: string) {
  if (a === b) return formatDateFr(a);
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return `${da.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} → ${db.toLocaleDateString(
    "fr-FR",
    { day: "2-digit", month: "long", year: "numeric" }
  )}`;
}