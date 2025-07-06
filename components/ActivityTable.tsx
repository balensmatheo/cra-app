import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Typography, Divider, IconButton, Select, MenuItem, TextField, Autocomplete } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { FC, useMemo, useRef, useCallback, useEffect, useState, memo } from 'react';

type Category = { id: number; label: string };
type SectionKey = "facturees" | "non_facturees" | "autres";

type ActivityTableProps = {
  sectionKey: SectionKey;
  label: string;
  days: Date[];
  categories: Category[];
  data: { [catId: number]: Record<string, string | undefined> };
  categoryOptions: string[];
  onCategoryChange: (catId: number, value: string) => void;
  onCellChange: (catId: number, date: string, value: string) => void;
  onAddCategory: () => void;
  onDeleteCategory: (catId: number) => void;
  getRowTotal: (catId: number) => number;
  getSectionTotal: () => number;
  onCommentChange: (catId: number, value: string) => void;
  tableRef?: (el: HTMLDivElement | null) => void;
  onTableScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
};

const allowedDayValues = ["0.25", "0.5", "0.50", "0.75", "1"];

const CategoryCell: FC<{
  value: string;
  record: Category;
  data: ActivityTableProps["data"];
  categoryOptions: string[];
  onCategoryChange: (catId: number, value: string) => void;
}> = memo(({ value, record, data, categoryOptions, onCategoryChange }) => {
  const rowData = useMemo(() => (typeof record.id === 'number' ? data[record.id] || {} : {}), [record.id, data]);
  const hasData = useMemo(() => Object.entries(rowData).some(([k, v]) => k !== 'comment' && v) || rowData.comment, [rowData]);
  const isInvalid = hasData && !value;
  const handleChange = useCallback((e: any) => { onCategoryChange(record.id, e.target.value); }, [record.id, onCategoryChange]);
  return (
    <Select
      value={value}
      onChange={handleChange}
      displayEmpty
      renderValue={(selected) => (selected ? selected : "Choisir une catégorie")}
      size="small"
      sx={{ width: '100%', fontWeight: 500, borderColor: isInvalid ? 'red' : undefined, background: isInvalid ? '#fff0f0' : undefined }}
      error={isInvalid === true}
    >
      <MenuItem value="">
        <em>Choisir une catégorie</em>
      </MenuItem>
      {categoryOptions.map((opt) => (
        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
      ))}
    </Select>
  );
});
CategoryCell.displayName = 'CategoryCell';

const CommentCell: FC<{ value: string; record: Category; onCommentChange: (catId: number, value: string) => void; }> = memo(({ value, record, onCommentChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => { setLocalValue(value); }, [value]);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { onCommentChange(record.id, newValue); }, 150);
  }, [record.id, onCommentChange]);
  return <TextField value={localValue} onChange={handleChange} placeholder="Nom du client, activité, ..." sx={{ width: '100%' }} size="small" />;
});
CommentCell.displayName = 'CommentCell';

const DayCell: FC<{ value: string; record: Category; day: Date; onCellChange: (catId: number, date: string, value: string) => void; }> = memo(({ value, record, day, onCellChange }) => {
  const isWeekend = useMemo(() => day.getDay() === 0 || day.getDay() === 6, [day]);
  const isValid = useMemo(() => value === "" || allowedDayValues.includes(value), [value]);
  const dayString = useMemo(() => day.toISOString().slice(0, 10), [day]);
  const handleChange = useCallback((_: any, newValue: string | null) => { onCellChange(record.id, dayString, newValue || ""); }, [record.id, dayString, onCellChange]);
  const handleInputChange = useCallback((_: any, newInputValue: string) => { if (newInputValue === "" || allowedDayValues.includes(newInputValue)) { onCellChange(record.id, dayString, newInputValue); } }, [record.id, dayString, onCellChange]);
  return (
    <Autocomplete
      freeSolo
      options={allowedDayValues}
      value={value}
      onChange={handleChange}
      onInputChange={handleInputChange}
      disabled={isWeekend}
      sx={{ width: '100%', maxWidth: '65px', background: isWeekend ? '#eee' : undefined, '& .MuiInputBase-root': { borderColor: isValid === false ? 'red' : undefined, color: isValid === false ? 'red' : undefined, fontSize: 14, height: 32, minHeight: 32, padding: 0, textAlign: 'center' }, '& .MuiOutlinedInput-input': { textAlign: 'center', padding: '4px 4px' }, '& .MuiAutocomplete-endAdornment': { display: 'none' } }}
      renderInput={(params) => (
        <TextField {...params} error={isValid === false} variant="outlined" size="small" placeholder="-" inputProps={{ ...params.inputProps, style: { textAlign: 'center', padding: 0, fontSize: 14, height: 32 } }} />
      )}
    />
  );
});
DayCell.displayName = 'DayCell';

export default function ActivityTable({
  sectionKey,
  label,
  days,
  categories,
  data,
  categoryOptions,
  onCategoryChange,
  onCellChange,
  onAddCategory,
  onDeleteCategory,
  getRowTotal,
  getSectionTotal,
  onCommentChange,
  tableRef,
  onTableScroll,
}: ActivityTableProps) {
  const localTableRef = useRef<HTMLDivElement>(null);

  const handleCategoryChange = useCallback((catId: number, value: string) => { onCategoryChange(catId, value); }, [onCategoryChange]);
  const handleCellChange = useCallback((catId: number, date: string, value: string) => { onCellChange(catId, date, value); }, [onCellChange]);
  const handleCommentChange = useCallback((catId: number, value: string) => { onCommentChange(catId, value); }, [onCommentChange]);
  const handleDeleteCategory = useCallback((catId: number) => { onDeleteCategory(catId); }, [onDeleteCategory]);

  const rows = useMemo(() =>
    categories.map((cat) => {
      const row = data[cat.id] || {};
      const obj: any = { id: cat.id, label: cat.label, comment: row.comment || '' };
      days.forEach((d) => { obj[d.toISOString().slice(0, 10)] = row[d.toISOString().slice(0, 10)] || ''; });
      return obj;
    }), [categories, data, days]);

  const columns = useMemo<GridColDef[]>(() => {
    const dayCols: GridColDef[] = days.map((d) => ({
      field: d.toISOString().slice(0, 10),
      width: 70,
      headerAlign: 'center',
      align: 'center',
      renderHeader: () => (
        <div style={{ fontSize: 12 }}>
          {d.getDate()}<br />
          <span style={{ fontSize: 10 }}>{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
        </div>
      ),
      renderCell: (params) => (
        <DayCell value={params.value || ''} record={{ id: params.row.id, label: params.row.label }} day={d} onCellChange={handleCellChange} />
      ),
    }));
    return [
      {
        field: 'label',
        headerName: 'Catégorie',
        width: 200,
        renderCell: (params) => (
          <CategoryCell
            value={params.value}
            record={{ id: params.row.id, label: params.row.label }}
            data={data}
            categoryOptions={categoryOptions}
            onCategoryChange={handleCategoryChange}
          />
        ),
      },
      {
        field: 'comment',
        headerName: 'Détails / Commentaires',
        width: 250,
        renderCell: (params) => (
          <CommentCell value={params.value} record={{ id: params.row.id, label: params.row.label }} onCommentChange={handleCommentChange} />
        ),
      },
      ...dayCols,
      {
        field: 'total',
        headerName: 'Total',
        width: 80,
        headerAlign: 'center',
        align: 'center',
        valueGetter: (params) => getRowTotal(params.row.id).toFixed(2),
        renderCell: (params) => (
          <Box sx={{ fontWeight: 600, color: '#894991', textAlign: 'center', width: '100%' }}>{params.value}</Box>
        ),
      },
      {
        field: 'action',
        headerName: 'Action',
        width: 60,
        headerAlign: 'center',
        align: 'center',
        sortable: false,
        renderCell: (params) => (
          <IconButton color="error" size="small" onClick={() => handleDeleteCategory(params.row.id)} disabled={categories.length === 1}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      },
    ];
  }, [days, data, categoryOptions, handleCategoryChange, handleCommentChange, handleCellChange, handleDeleteCategory, getRowTotal, categories.length]);

  useEffect(() => { if (tableRef) tableRef(localTableRef.current); }, [tableRef]);

  return (
    <div style={{ marginBottom: 6, position: 'relative', paddingBottom: 10 }}>
      <Typography variant="h5" sx={{ color: '#894991', mb: 1 }}>{label}</Typography>
      <Box
        ref={localTableRef}
        onScroll={onTableScroll}
        sx={{ height: 400, width: '100%', overflow: 'auto', '&::-webkit-scrollbar': { width: '8px', height: '8px' }, '&::-webkit-scrollbar-track': { background: '#f1f1f1', borderRadius: '4px' }, '&::-webkit-scrollbar-thumb': { background: '#c1c1c1', borderRadius: '4px', '&:hover': { background: '#a8a8a8' } } }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          hideFooter
          disableColumnMenu
          disableRowSelectionOnClick
          sx={{ minWidth: `${200 + 250 + days.length * 70 + 80 + 60}px` }}
        />
      </Box>
      <Box sx={{ display: 'flex', mt: 1 }}>
        <IconButton
          color="primary"
          onClick={onAddCategory}
          sx={{ background: '#f8f9fa', border: '1px dashed #ccc', borderRadius: 1, width: '200px', height: 32, '&:hover': { background: '#e9ecef', borderColor: '#8e4890' } }}
          size="small"
        >
          <AddIcon fontSize="small" sx={{ color: '#666' }} />
        </IconButton>
      </Box>
      <Typography sx={{ fontWeight: 400, color: '#666', mt: 1, textAlign: 'right', fontSize: '0.9rem' }}>
        Total {label} : {getSectionTotal().toFixed(2)}
      </Typography>
      <Divider sx={{ mt: 2 }} />
    </div>
  );
}
