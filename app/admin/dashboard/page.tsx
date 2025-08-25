"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Chip,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const client = generateClient<Schema>();

type PeriodType = "month" | "year" | "custom";

function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [team, setTeam] = useState<string>("");
  const [users, setUsers] = useState<{ sub: string; name: string; groups: string[] }[]>([]);
  const [user, setUser] = useState<string>("");
  const [categories, setCategories] = useState<Record<string, { label: string; kind: "facturee" | "non_facturee" | "autre" | null }>>({});
  const [entries, setEntries] = useState<Schema["CraEntry"]["type"][]>([]);
  const [activityKind, setActivityKind] = useState<"" | "facturee" | "non_facturee" | "autre">("");
  const [drill, setDrill] = useState<{ title: string; rows: any[] } | null>(null);

  // Admin check
  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.idToken?.payload?.["cognito:groups"] as string[]) || [];
        const ok = groups.includes("ADMINS");
        setIsAdmin(ok);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  // Default period
  useEffect(() => {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(s);
    setEndDate(e);
  }, []);

  // Load categories and users (robust mapping of listUsers output)
  useEffect(() => {
    (async () => {
      // Categories
      try {
        const { data: cats } = await client.models.Category.list({});
        const map: Record<string, { label: string; kind: any }> = {};
        (cats || []).forEach((c: any) => { map[c.id] = { label: c.label, kind: c.kind }; });
        setCategories(map as any);
      } catch {}

      // Users for filters
      try {
        const { data, errors } = await client.queries.listUsers({} as any);
        if (errors) throw new Error(errors[0]?.message || 'listUsers error');
        const payload = typeof data === 'string' ? JSON.parse(data as any) : (data as any);
        const pool: Array<{ username: string; email?: string; given_name?: string; family_name?: string; groups?: string[] }> = (payload?.users || []) as any[];
        const list = pool.map(u => ({
          sub: u.username,
          name: `${u.given_name || ''} ${u.family_name || ''}`.trim() || (u.email || u.username),
          groups: Array.isArray(u.groups) ? u.groups : [],
        }));
        // Keep only non-system groups for teams and sort names
        const teamNames = Array.from(new Set(list.flatMap(u => u.groups).filter(g => g && g !== 'USERS' && g !== 'ADMINS'))).sort();
        setTeams(teamNames);
        setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        // If listing users fails, leave filters empty; the dashboard still works without user filter
        setUsers([]);
        setTeams([]);
      }
    })();
  }, []);

  // Load validated CRA entries within the period, with optional filters.
  const loadData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      // Determine months to include
      const sMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const eMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      const months: string[] = [];
      const it = new Date(sMonth);
      while (it <= eMonth) {
        months.push(monthKey(it));
        it.setMonth(it.getMonth() + 1);
      }
      const allEntries: Schema["CraEntry"]["type"][] = [];
      // For each month, list validated CRAs and then fetch their entries
      for (const m of months) {
        const { data: cras } = await client.models.Cra.list({ filter: { month: { eq: m }, status: { eq: "validated" as any } } });
        const filteredCras = (cras || []).filter((c: any) => {
          if (user) return c.owner === user;
          if (team) {
            const u = users.find((u) => u.sub === c.owner);
            return u ? u.groups.includes(team) : false;
          }
          return true;
        });
        for (const c of filteredCras) {
          const { data: list } = await (client.models.CraEntry.list as any)({ filter: { craId: { eq: c.id } } });
          const within = (list || []).filter((e: any) => e.date >= formatYMD(startDate) && e.date <= formatYMD(endDate));
          allEntries.push(...within as any);
        }
      }
      setEntries(allEntries);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, team, user, users]);

  useEffect(() => { loadData(); }, [loadData]);

  // Aggregations
  const agg = useMemo(() => {
    // Apply activity kind filter if any
    const filtered = entries.filter((e: any) => {
      if (!activityKind) return true;
      const k = (categories[String(e.categoryId)]?.kind || "autre") as any;
      return k === activityKind;
    });
    const sums = { facturee: 0, non_facturee: 0, autre: 0 } as Record<string, number>;
    const byMonth: Record<string, { facturee: number; non_facturee: number; autre: number }> = {};
    const pie: Record<string, number> = {};
    const details: any[] = [];
    filtered.forEach((e: any) => {
      const catId = String(e.categoryId);
      const kind = (categories[catId]?.kind || "autre") as "facturee" | "non_facturee" | "autre";
      sums[kind] += e.value || 0;
      const mk = e.date.slice(0, 7);
      byMonth[mk] = byMonth[mk] || { facturee: 0, non_facturee: 0, autre: 0 };
      byMonth[mk][kind] += e.value || 0;
      const label = categories[catId]?.label || "Autre";
      pie[label] = (pie[label] || 0) + (e.value || 0);
      details.push({ date: e.date, category: label, kind, value: e.value });
    });
    const total = sums.facturee + sums.non_facturee + sums.autre;
    const billingRate = total > 0 ? (sums.facturee / total) * 100 : 0;
    // time series
    const timeline = Object.keys(byMonth)
      .sort()
      .map((k) => ({ month: k, facturees: byMonth[k].facturee, non_facturees: byMonth[k].non_facturee, autres: byMonth[k].autre, taux: byMonth[k].facturee / Math.max(1e-6, byMonth[k].facturee + byMonth[k].non_facturee + byMonth[k].autre) * 100 }));
    const barData = timeline.map((t) => ({ month: t.month, Facturées: t.facturees, "Non facturées": t.non_facturees, Autres: t.autres }));
    const pieData = Object.keys(pie).map((k) => ({ name: k, value: pie[k] }));
    // Top 5 users and non-billed activities would require owner mapping; skipping for MVP.
    return { billingRate, total, sums, timeline, barData, pieData, details };
  }, [entries, categories, activityKind]);

  const exportCSV = useCallback((rows: any[]) => {
    const header = Object.keys(rows[0] || { date: "", category: "", kind: "", value: 0 });
    const csv = [header.join(",")].concat(
      rows.map((r) => header.map((h) => String(r[h] ?? "")).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (isAdmin === null) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={260} height={36} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={160} />
      </Box>
    );
  }
  if (!isAdmin) return <Box sx={{ p: 4 }}><Typography color="error">Accès refusé</Typography></Box>;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: "#894991", mb: 2 }}>Dashboard</Typography>

      {/* Filtres */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Période</InputLabel>
            <Select value={periodType ?? 'month'} label="Période" onChange={(e) => {
              const v = e.target.value as PeriodType;
              setPeriodType(v);
              const now = new Date();
              if (v === "month") {
                setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
                setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
              } else if (v === "year") {
                setStartDate(new Date(now.getFullYear(), 0, 1));
                setEndDate(new Date(now.getFullYear(), 11, 31));
              }
            }}>
              <MenuItem value="month">Mois courant</MenuItem>
              <MenuItem value="year">Année en cours</MenuItem>
              <MenuItem value="custom">Personnalisée</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} md={3}>
          <DatePicker label="Début" value={startDate} onChange={(d) => setStartDate(d as any)} slotProps={{ textField: { size: "small", fullWidth: true } }} disabled={periodType !== "custom"} />
        </Grid>
        <Grid item xs={6} md={3}>
          <DatePicker label="Fin" value={endDate} onChange={(d) => setEndDate(d as any)} slotProps={{ textField: { size: "small", fullWidth: true } }} disabled={periodType !== "custom"} />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Équipe</InputLabel>
            <Select value={team ?? ''} label="Équipe" onChange={(e) => { setTeam((e.target.value as string) || ''); setUser(''); }}>
              <MenuItem value=""><em>Toutes</em></MenuItem>
              {(teams || []).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Utilisateur</InputLabel>
            <Select value={user ?? ''} label="Utilisateur" onChange={(e) => setUser((e.target.value as string) || '')}>
              <MenuItem value=""><em>Tous</em></MenuItem>
              {(users || [])
                .filter((u) => !team || u.groups.includes(team))
                .map((u) => <MenuItem key={u.sub} value={u.sub}>{u.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Type d'activité</InputLabel>
            <Select value={activityKind ?? ''} label="Type d'activité" onChange={(e) => setActivityKind((e.target.value as any) || '')}>
              <MenuItem value=""><em>Toutes</em></MenuItem>
              <MenuItem value="facturee">Facturées</MenuItem>
              <MenuItem value="non_facturee">Non facturées</MenuItem>
              <MenuItem value="autre">Autres</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* KPI */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ color: "#6b7280" }}>Taux de facturation</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{agg.billingRate.toFixed(1)}%</Typography>
              <Typography variant="caption" sx={{ color: "#6b7280" }}>Total heures: {agg.total.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography variant="subtitle2" sx={{ color: "#6b7280" }}>Facturées</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{(agg.sums.facturee || 0).toFixed(2)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography variant="subtitle2" sx={{ color: "#6b7280" }}>Non facturées</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{(agg.sums.non_facturee || 0).toFixed(2)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography variant="subtitle2" sx={{ color: "#6b7280" }}>Autres</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{(agg.sums.autre || 0).toFixed(2)}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* Graphiques */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: 320 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Évolution du taux de facturation</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={agg.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                  <ChartTooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="taux" stroke="#894991" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 320 }}>
            <CardContent sx={{ height: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle2">Distribution par catégorie</Typography>
                <Tooltip title="Exporter CSV de la distribution">
                  <IconButton size="small" onClick={() => exportCSV(agg.pieData)}>
                    <DownloadOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={agg.pieData} dataKey="value" nameKey="name" outerRadius={90} onClick={(d: any) => {
                    const name = d?.name as string;
                    const rows = agg.details.filter((r) => r.category === name);
                    setDrill({ title: `Détail — ${name}`, rows });
                  }}>
                    {agg.pieData.map((_, i) => (
                      <Cell key={i} fill={["#894991", "#2e7d32", "#0b79d0", "#d97706", "#ef4444", "#6366f1"][i % 6]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Répartition mensuelle (empilée)</Typography>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agg.barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip />
              <Legend />
              <Bar dataKey="Facturées" stackId="a" fill="#2e7d32" onClick={(d: any) => { setDrill({ title: `Facturées — ${d?.month}`, rows: agg.details.filter((r) => r.date.startsWith(d?.month) && r.kind === "facturee") }); }} />
              <Bar dataKey="Non facturées" stackId="a" fill="#0b79d0" onClick={(d: any) => { setDrill({ title: `Non facturées — ${d?.month}`, rows: agg.details.filter((r) => r.date.startsWith(d?.month) && r.kind === "non_facturee") }); }} />
              <Bar dataKey="Autres" stackId="a" fill="#894991" onClick={(d: any) => { setDrill({ title: `Autres — ${d?.month}`, rows: agg.details.filter((r) => r.date.startsWith(d?.month) && r.kind === "autre") }); }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Drill-down */}
      {drill && (
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2">{drill.title}</Typography>
              <Box>
                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => exportCSV(drill.rows)}>Exporter CSV</Button>
                <Chip label={`${drill.rows.length} lignes`} size="small" sx={{ ml: 1 }} />
              </Box>
            </Box>
            <Divider sx={{ mb: 1 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Catégorie</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Valeur</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drill.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.kind}</TableCell>
                    <TableCell align="right">{Number(r.value || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
