"use client";

import { useEffect, useMemo, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Box, Button, Card, CardContent, Grid, IconButton, Snackbar, TextField, Typography, Chip, Stack, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl, Tooltip, CircularProgress, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { fetchAuthSession } from 'aws-amplify/auth';
import { uploadData } from 'aws-amplify/storage';
import { fr } from 'date-fns/locale';
import { format, parse, isValid } from 'date-fns';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

const client = generateClient<Schema>();

// Simple, modern drag & drop zone
function FileDropzone({ file, onFile, maxSizeMB = 25 }: { file: File | null; onFile: (f: File | null) => void; maxSizeMB?: number }) {
	const [drag, setDrag] = useState(false);
	const inputId = 'file-input-' + Math.random().toString(36).slice(2);
	const handleFiles = (files: FileList | null) => {
		if (!files || files.length === 0) return;
		const f = files[0];
		const limit = maxSizeMB * 1024 * 1024;
		if (f.size > limit) {
			alert(`Fichier trop volumineux (> ${maxSizeMB} Mo)`);
			return;
		}
		onFile(f);
	};
	return (
		<Box>
			<Box
				onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
				onDragLeave={() => setDrag(false)}
				onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
				onClick={() => document.getElementById(inputId)?.click()}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById(inputId)?.click(); } }}
				sx={{
					border: '2px dashed ' + (drag ? '#894991' : '#d8c9e0'),
					background: drag ? '#faf3ff' : '#fcfaff',
					color: '#6a3a7a',
					borderRadius: 2,
					p: 3,
					display: 'grid',
					placeItems: 'center',
					cursor: 'pointer',
					transition: 'all .15s ease-in-out'
				}}
			>
				<Box sx={{ textAlign: 'center' }}>
					<CloudUploadOutlinedIcon sx={{ fontSize: 36, color: drag ? '#894991' : '#9b6aa6', mb: 1 }} />
					<Typography sx={{ fontWeight: 700 }}>Placez le fichier ici ou cliquez pour le sélectionner</Typography>
					<Typography variant="body2" sx={{ color: '#7b6282' }}>PDF, JPG, PNG, DOCX — {maxSizeMB} Mo max</Typography>
				</Box>
			</Box>
			<input id={inputId} type="file" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
			{file && (
				<Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, border: '1px solid #eee', borderRadius: 1.5 }}>
					<Typography variant="body2" sx={{ mr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</Typography>
					<IconButton size="small" onClick={() => onFile(null)} aria-label="Supprimer le fichier"><CloseIcon fontSize="small" /></IconButton>
				</Box>
			)}
		</Box>
	);
}

type LR = Schema['LeaveRequest']['type'];

export default function CongePage() {
	// Dialog state
	const [dialogOpen, setDialogOpen] = useState(false);
	const [absenceType, setAbsenceType] = useState<'conge'|'maladie'|'universitaire' | ''>('');
	// Range selection via calendar
	const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined });
	const [startDate, setStartDate] = useState<string>('');
	const [endDate, setEndDate] = useState<string>('');
	const [showCalendar, setShowCalendar] = useState(false);
	const [reason, setReason] = useState('');
	const [file, setFile] = useState<File | null>(null);
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(false);
	const [list, setList] = useState<LR[]>([]);
	const [snack, setSnack] = useState<{open:boolean; message:string; severity:'success'|'error'|'info'}>({open:false,message:'',severity:'success'});
	const [clearing, setClearing] = useState(false);
	const [meSub, setMeSub] = useState<string | null>(null);

	const load = async () => {
		if (!meSub) return;
		try {
			const { data } = await client.models.LeaveRequest.list({});
			const mine = ((data || []) as LR[]).filter(lr => ((lr as any).owner as string | undefined) === meSub);
			setList(mine);
		} catch (e: any) {
			setSnack({open:true, message: e.message || 'Erreur chargement', severity: 'error'});
		}
	};

	useEffect(() => {
		(async () => {
			try {
				const session = await fetchAuthSession();
				const sub = (session.tokens?.idToken?.payload as any)?.sub as string | undefined;
				setMeSub(sub || null);
			} catch {
				setMeSub(null);
			}
		})();
	}, []);

	useEffect(() => { if (meSub) load(); }, [meSub]);

	const parsedStart = useMemo(() => startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : null, [startDate]);
	const parsedEnd = useMemo(() => endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : null, [endDate]);
	const typedPairValid = !!(parsedStart && parsedEnd && isValid(parsedStart) && isValid(parsedEnd) && +parsedStart <= +parsedEnd);
	const canSubmit = useMemo(() => {
		return !!absenceType && (!!(range.from && range.to) || typedPairValid);
	}, [absenceType, range, typedPairValid]);

		const submit = async () => {
		if (!canSubmit) return;
		setSending(true);
		try {
				// Convert selected range to YYYY-MM-DD in local time (avoid UTC shift)
				const s = range.from ? format(range.from, 'yyyy-MM-dd') : (typedPairValid ? startDate : '');
				const e = range.to ? format(range.to, 'yyyy-MM-dd') : (typedPairValid ? endDate : '');
			let attachmentKey: string | undefined = undefined;
				let attachmentIdentityId: string | undefined = undefined;
			if (file) {
				const key = `leave-attachments/${Date.now()}-${encodeURIComponent(file.name)}`;
				await uploadData({ key, data: file, options: { accessLevel: 'protected' } }).result;
				attachmentKey = key;
					try {
						const s = await fetchAuthSession();
						attachmentIdentityId = (s.identityId as string) || undefined;
					} catch {}
			}
				await client.models.LeaveRequest.create({ startDate: s as any, endDate: e as any, status: 'pending' as any, reason, absenceType: absenceType as any, attachmentKey: attachmentKey as any, attachmentIdentityId: attachmentIdentityId as any });
			// reset
			setAbsenceType('');
				setRange({ from: undefined, to: undefined });
				setStartDate('');
				setEndDate('');
			setReason('');
			setFile(null);
			setDialogOpen(false);
			setSnack({open:true, message:'Demande envoyée', severity:'success'});
			await load();
		} catch (e: any) {
			setSnack({open:true, message: e.message || 'Erreur envoi', severity:'error'});
		} finally {
			setSending(false);
		}
	};

	const remove = async (id: string) => {
		try {
			await client.models.LeaveRequest.delete({ id });
			await load();
		} catch (e: any) {
			setSnack({open:true, message: e.message || 'Erreur suppression', severity:'error'});
		}
	};

	const clearHistory = async () => {
		// Only delete past requests (endDate < today), excluding pending
		const today = new Date();
		const y = today.getFullYear();
		const m = String(today.getMonth() + 1).padStart(2, '0');
		const d = String(today.getDate()).padStart(2, '0');
		const todayStr = `${y}-${m}-${d}`;
		const deletable = list.filter(lr => (lr as any).status !== 'pending' && lr.endDate < todayStr);
		if (deletable.length === 0) {
			setSnack({ open:true, message:"Aucun congé passé à supprimer", severity:'info' });
			return;
		}
		const ok = typeof window !== 'undefined' ? window.confirm(`Supprimer ${deletable.length} congé(s) passé(s) ?`) : true;
		if (!ok) return;
		setClearing(true);
		try {
			const results = await Promise.allSettled(deletable.map(d => client.models.LeaveRequest.delete({ id: d.id })));
			const failures = results.filter(r => r.status === 'rejected').length;
			if (failures === 0) setSnack({ open:true, message:'Historique vidé', severity:'success' });
			else setSnack({ open:true, message:`Historique partiellement vidé (${failures} échec(s))`, severity:'info' });
			await load();
		} catch (e:any) {
			setSnack({ open:true, message: e.message || 'Erreur lors du vidage', severity:'error' });
		} finally { setClearing(false); }
	};

	return (
		<Box sx={{ p: 4 }}>
			<Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb: 2, gap: 2, flexWrap:'wrap' }}>
				<Typography variant="h5" sx={{ fontWeight: 700, color: '#894991' }}>Mes demandes de congés</Typography>
				<Tooltip title="Demander une absence">
					<Button variant="contained" startIcon={<AddIcon />} onClick={()=>setDialogOpen(true)} sx={{ textTransform:'none', background:'#894991', '&:hover':{ background:'#6a3a7a' }}}>Demander une absence</Button>
				</Tooltip>
			</Box>

			{/* Congés validés (actuels et à venir) */}
			{(() => {
				// Calcul des congés approuvés dont la période n'est pas terminée (endDate >= aujourd'hui)
				const today = new Date();
				const y = today.getFullYear();
				const m = String(today.getMonth() + 1).padStart(2, '0');
				const d = String(today.getDate()).padStart(2, '0');
				const todayStr = `${y}-${m}-${d}`;
				const approved = (list || [])
					.filter(lr => (lr as any).status === 'approuvee' && lr.endDate >= todayStr)
					.sort((a, b) => a.startDate.localeCompare(b.startDate));
				if (approved.length === 0) return (
					<Card elevation={0} sx={{ border: '1px solid #eee', borderRadius: 2, mb: 3 }}>
						<CardContent>
							<Typography sx={{ fontWeight: 600, mb: 1 }}>Congés validés</Typography>
							<Typography variant="body2" sx={{ color: '#777' }}>Aucun congé validé en cours ou à venir.</Typography>
						</CardContent>
					</Card>
				);
				return (
					<Card elevation={0} sx={{ border: '1px solid #eee', borderRadius: 2, mb: 3 }}>
						<CardContent>
							<Typography sx={{ fontWeight: 600, mb: 1 }}>Congés validés</Typography>
							<Grid container spacing={1.5}>
								{approved.map(lr => {
									const statusChip = lr.startDate <= todayStr && lr.endDate >= todayStr ? 'En cours' : 'À venir';
									const type = (lr as any).absenceType as string | undefined;
									const typeLabel = type === 'conge' ? 'Congés' : type === 'maladie' ? 'Congé maladie' : type === 'universitaire' ? 'Temps universitaire' : undefined;
									return (
										<Grid item xs={12} md={6} key={`approved-${lr.id}`}>
											<Card elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2 }}>
												<CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
													<Box>
														<Typography sx={{ fontWeight: 700 }}>{lr.startDate} → {lr.endDate}</Typography>
														{lr.reason && <Typography variant="body2" sx={{ color: '#777' }}>{lr.reason}</Typography>}
													</Box>
													<Stack direction="row" spacing={1} alignItems="center">
														{typeLabel && <Chip size="small" label={typeLabel} />}
														<Chip size="small" label={statusChip} color={statusChip === 'En cours' ? 'success' as any : 'default'} sx={{ fontWeight: 600 }} />
													</Stack>
												</CardContent>
											</Card>
										</Grid>
									);
								})}
							</Grid>
						</CardContent>
					</Card>
				);
			})()}


			{/* Dialog: Demander une absence */}
			<Dialog
				open={dialogOpen}
				onClose={() => !sending && setDialogOpen(false)}
				maxWidth="md"
				fullWidth
				PaperProps={{ sx: { maxWidth: 900 } }}
			>
				<DialogTitle>Nouvelle demande d'absence</DialogTitle>
				<DialogContent dividers>
					<Box sx={{ display:'grid', gap: 2 }}>
						<FormControl size="small" fullWidth>
							<InputLabel id="absence-type-label">Type d'absence</InputLabel>
							<Select labelId="absence-type-label" label="Type d'absence" value={absenceType} onChange={(e)=>setAbsenceType(e.target.value as any)}>
								<MenuItem value={'conge'}>Congés</MenuItem>
								<MenuItem value={'maladie'}>Congé maladie</MenuItem>
								<MenuItem value={'universitaire'}>Temps universitaire</MenuItem>
							</Select>
						</FormControl>
										<Grid container spacing={1.5} alignItems="center">
											<Grid item xs={12} sm={6}>
												<TextField
													label="Date de début"
													placeholder="YYYY-MM-DD"
													size="small"
													fullWidth
													value={startDate}
													onChange={(e) => setStartDate(e.target.value)}
													onBlur={() => {
														const d = startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : null;
														if (d && isValid(d)) {
															const newFrom = d;
															const newTo = range.to && isValid(range.to) ? range.to : undefined;
															setRange(prev => ({ from: newFrom, to: newTo }));
														}
													}}
													InputProps={{
														endAdornment: (
															<InputAdornment position="end">
																<IconButton onClick={() => setShowCalendar(v => !v)}>
																	<CalendarMonthOutlinedIcon />
																</IconButton>
															</InputAdornment>
														)
													}}
												/>
											</Grid>
											<Grid item xs={12} sm={6}>
												<TextField
													label="Date de fin"
													placeholder="YYYY-MM-DD"
													size="small"
													fullWidth
													value={endDate}
													onChange={(e) => setEndDate(e.target.value)}
													onBlur={() => {
														const d = endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : null;
														if (d && isValid(d)) {
															const newTo = d;
															const newFrom = range.from && isValid(range.from) ? range.from : undefined;
															setRange(prev => ({ from: newFrom, to: newTo }));
														}
													}}
													InputProps={{
														endAdornment: (
															<InputAdornment position="end">
																<IconButton onClick={() => setShowCalendar(v => !v)}>
																	<CalendarMonthOutlinedIcon />
																</IconButton>
															</InputAdornment>
														)
													}}
												/>
											</Grid>
										</Grid>
										{showCalendar && (
											<Box
												sx={{
													border: '1px solid #eee',
													borderRadius: 2,
													p: 1,
													mt: 1.5,
													width: '100%',
													display: 'flex',
													justifyContent: 'center',
													// Shrink and keep months side-by-side and centered
													'& .rdp': { fontSize: '0.9rem' },
													'& .rdp-months': { display: 'flex', flexWrap: 'nowrap', gap: '12px', justifyContent: 'center' },
													'& .rdp-month': { margin: 0 },
													'& .rdp-caption_label': { fontSize: '0.95rem', fontWeight: 600 },
													'& .rdp-day': { lineHeight: 1 },
												}}
											>
												<DayPicker
													mode="range"
													selected={range}
													onSelect={(r: DateRange | undefined)=> {
														const next: DateRange = r ?? { from: undefined, to: undefined };
														setRange(next);
														setStartDate(next.from ? format(next.from, 'yyyy-MM-dd') : '');
														setEndDate(next.to ? format(next.to, 'yyyy-MM-dd') : '');
													}}
													locale={fr as any}
													showOutsideDays={false}
													numberOfMonths={2}
													weekStartsOn={1}
													styles={{
														root: { fontSize: '0.9rem' },
														day: { width: '2.2rem', height: '2.2rem' },
														caption_label: { fontSize: '0.95rem' },
													}}
												/>
											</Box>
										)}
						<TextField label="Commentaire" placeholder="Laisser une note..." value={reason} onChange={(e)=>setReason(e.target.value)} inputProps={{ maxLength: 140 }} multiline rows={3} />
											<Box>
												<Typography variant="body2" sx={{ mb: 1 }}>Pièce jointe</Typography>
												<FileDropzone file={file} onFile={setFile} />
											</Box>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={()=>!sending && setDialogOpen(false)} disabled={sending} sx={{ textTransform:'none' }}>Annuler</Button>
					<Button onClick={submit} disabled={!canSubmit || sending} variant="contained" sx={{ textTransform:'none', background:'#894991', '&:hover':{ background:'#6a3a7a' }}}>
						{sending ? <CircularProgress size={18} sx={{ color:'#fff' }} /> : 'Soumettre'}
					</Button>
				</DialogActions>
			</Dialog>

			<Box sx={{ mb: 1.5, display:'flex', alignItems:'center', justifyContent:'space-between', gap: 2, flexWrap:'wrap' }}>
				<Typography sx={{ fontWeight: 600 }}>Historique</Typography>
				<Button
					variant="outlined"
					size="small"
					onClick={clearHistory}
						disabled={(() => {
							if (clearing) return true;
							const today = new Date();
							const y = today.getFullYear();
							const m = String(today.getMonth() + 1).padStart(2, '0');
							const d = String(today.getDate()).padStart(2, '0');
							const todayStr = `${y}-${m}-${d}`;
							return list.filter(lr => (lr as any).status !== 'pending' && lr.endDate < todayStr).length === 0;
						})()}
					sx={{ textTransform:'none' }}
				>Vider l'historique</Button>
			</Box>
			<Grid container spacing={1.5}>
				{list.map((lr) => (
					<Grid item xs={12} md={6} key={lr.id}>
						<Card elevation={0} sx={{ border: '1px solid #eee', borderRadius: 2 }}>
							<CardContent sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 2 }}>
								<Box>
									<Typography sx={{ fontWeight: 700 }}>{lr.startDate} → {lr.endDate}</Typography>
									<Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
										<Typography variant="body2" sx={{ color:'#666' }}>{(lr as any).status}</Typography>
										{(() => { const t = (lr as any).absenceType as string | undefined; const lbl = t === 'conge' ? 'Congés' : t === 'maladie' ? 'Congé maladie' : t === 'universitaire' ? 'Temps universitaire' : undefined; return lbl ? <Chip size="small" label={lbl} /> : null; })()}
									</Stack>
									{lr.reason && <Typography variant="body2" sx={{ color:'#777' }}>{lr.reason}</Typography>}
									{(lr as any).adminNote && (
										<Typography variant="body2" sx={{ color:'#444', mt: 0.5 }}>
											Message de l'administrateur: {(lr as any).adminNote}
										</Typography>
									)}
								</Box>
								{(lr as any).status === 'pending' && (
									<IconButton onClick={() => remove(lr.id)} title="Annuler la demande"><DeleteOutlineIcon /></IconButton>
								)}
							</CardContent>
						</Card>
					</Grid>
				))}
				{list.length === 0 && (
					<Grid item xs={12}><Typography sx={{ color:'#777' }}>Aucune demande.</Typography></Grid>
				)}
			</Grid>
			<Snackbar open={snack.open} onClose={()=>setSnack(s=>({...s,open:false}))} message={snack.message} autoHideDuration={2500} />
		</Box>
	);
}
