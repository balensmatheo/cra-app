import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { FC, useRef, useState, useMemo, useCallback, memo, useEffect } from "react";
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';

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
  const rowData = useMemo(() => {
    return typeof record.id === 'number' ? data[record.id] || {} : {};
  }, [record.id, data]);
  
  const hasData = useMemo(() => {
    return Object.entries(rowData).some(([k, v]) => k !== 'comment' && v) || rowData.comment;
  }, [rowData]);
  
  const isInvalid = hasData && !value;
  
  const handleChange = useCallback((e: any) => {
    onCategoryChange(record.id, e.target.value);
  }, [record.id, onCategoryChange]);
  
  return (
    <Select
      value={value}
      onChange={handleChange}
      displayEmpty
      renderValue={selected => selected ? selected : "Choisir une catégorie"}
      size="small"
      sx={{ 
        width: '100%',
        fontWeight: 500, 
        borderColor: isInvalid ? 'red' : undefined, 
        background: isInvalid ? '#fff0f0' : undefined 
      }}
      error={isInvalid === true}
    >
      <MenuItem value="">
        <em>Choisir une catégorie</em>
      </MenuItem>
      {categoryOptions.map(opt => (
        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
      ))}
    </Select>
  );
});

CategoryCell.displayName = 'CategoryCell';

const CommentCell: FC<{
  value: string;
  record: Category;
  onCommentChange: (catId: number, value: string) => void;
}> = memo(({ value, record, onCommentChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Synchroniser la valeur locale avec la valeur externe
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Nettoyer le timeout lors du démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Annuler le timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Déclencher la mise à jour externe après 150ms d'inactivité
    timeoutRef.current = setTimeout(() => {
      onCommentChange(record.id, newValue);
    }, 150);
  }, [record.id, onCommentChange]);
  
  return (
    <TextField
      value={localValue}
      onChange={handleChange}
      placeholder="Nom du client, activité, ..."
      sx={{ width: '100%' }}
      size="small"
    />
  );
});

CommentCell.displayName = 'CommentCell';

const DayCell: FC<{
  value: string;
  record: Category;
  day: Date;
  onCellChange: (catId: number, date: string, value: string) => void;
}> = memo(({ value, record, day, onCellChange }) => {
  const isWeekend = useMemo(() => day.getDay() === 0 || day.getDay() === 6, [day]);
  const isValid = useMemo(() => value === "" || allowedDayValues.includes(value), [value]);
  const dayString = useMemo(() => day.toISOString().slice(0, 10), [day]);
  
  const handleChange = useCallback((_, newValue: string | null) => {
    onCellChange(record.id, dayString, newValue || "");
  }, [record.id, dayString, onCellChange]);
  
  const handleInputChange = useCallback((_, newInputValue: string) => {
    // Ne déclencher que si la valeur est valide ou vide
    if (newInputValue === "" || allowedDayValues.includes(newInputValue)) {
      onCellChange(record.id, dayString, newInputValue);
    }
  }, [record.id, dayString, onCellChange]);
  
  return (
    <Autocomplete
      freeSolo
      options={allowedDayValues}
      value={value}
      onChange={handleChange}
      onInputChange={handleInputChange}
      disabled={isWeekend}
      sx={{
        width: '100%',
        maxWidth: '65px',
        background: isWeekend ? '#eee' : undefined,
        '& .MuiInputBase-root': {
          borderColor: isValid === false ? 'red' : undefined,
          color: isValid === false ? 'red' : undefined,
          fontSize: 14,
          height: 32,
          minHeight: 32,
          padding: 0,
          textAlign: 'center',
        },
        '& .MuiOutlinedInput-input': {
          textAlign: 'center',
          padding: '4px 4px',
        },
        '& .MuiAutocomplete-endAdornment': {
          display: 'none',
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          error={isValid === false}
          variant="outlined"
          size="small"
          placeholder="-"
          inputProps={{ ...params.inputProps, style: { textAlign: 'center', padding: 0, fontSize: 14, height: 32 } }}
        />
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

  // Memoize les handlers pour éviter les re-rendus
  const handleCategoryChange = useCallback((catId: number, value: string) => {
    onCategoryChange(catId, value);
  }, [onCategoryChange]);

  const handleCellChange = useCallback((catId: number, date: string, value: string) => {
    onCellChange(catId, date, value);
  }, [onCellChange]);

  const handleCommentChange = useCallback((catId: number, value: string) => {
    onCommentChange(catId, value);
  }, [onCommentChange]);

  const handleDeleteCategory = useCallback((catId: number) => {
    onDeleteCategory(catId);
  }, [onDeleteCategory]);

  // Memoize les en-têtes de colonnes pour éviter les re-rendus
  const dayHeaders = useMemo(() => 
    days.map((d) => (
      <TableCell key={d.toISOString().slice(0, 10)} align="center" sx={{ 
        px: 0.5, 
        width: '70px', 
        minWidth: '70px',
        maxWidth: '70px'
      }}>
        <div style={{ fontSize: 12 }}>
          {d.getDate()}<br />
          <span style={{ fontSize: 10 }}>{d.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
        </div>
      </TableCell>
    )), [days]);

  // Memoize les lignes de données
  const tableRows = useMemo(() => 
    categories.map((cat) => (
      <TableRow key={cat.id}>
        <TableCell sx={{ width: '200px', minWidth: '200px' }}>
          <CategoryCell
            value={cat.label}
            record={cat}
            data={data}
            categoryOptions={categoryOptions}
            onCategoryChange={handleCategoryChange}
          />
        </TableCell>
        <TableCell sx={{ width: '250px', minWidth: '250px' }}>
          <CommentCell
            value={data[cat.id]?.comment || ""}
            record={cat}
            onCommentChange={handleCommentChange}
          />
        </TableCell>
        {days.map((d) => (
          <TableCell key={d.toISOString().slice(0, 10)} align="center" sx={{ 
            px: 0.5, 
            width: '70px', 
            minWidth: '70px',
            maxWidth: '70px'
          }}>
            <DayCell
              value={data[cat.id]?.[d.toISOString().slice(0, 10)] || ""}
              record={cat}
              day={d}
              onCellChange={handleCellChange}
            />
          </TableCell>
        ))}
        <TableCell align="center" sx={{ fontWeight: 600, color: "#894991", width: '80px', minWidth: '80px' }}>
          {getRowTotal(cat.id).toFixed(2)}
        </TableCell>
        <TableCell align="center" sx={{ width: '60px', minWidth: '60px' }}>
          <IconButton
            color="error"
            size="small"
            onClick={() => handleDeleteCategory(cat.id)}
            disabled={categories.length === 1}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    )), [categories, data, days, categoryOptions, handleCategoryChange, handleCommentChange, handleCellChange, handleDeleteCategory, getRowTotal]);

  // Appeler la fonction de ref pour enregistrer la référence
  useEffect(() => {
    if (tableRef) {
      tableRef(localTableRef.current);
    }
  }, [tableRef]);

  return (
    <div style={{ marginBottom: 6, position: 'relative', paddingBottom: 10 }}>
      <Typography variant="h5" sx={{ color: "#894991", mb: 1 }}>{label}</Typography>
      <TableContainer 
        ref={localTableRef} 
        onScroll={onTableScroll}
        sx={{ 
          maxHeight: '400px',
          overflow: 'auto',
          '& .MuiTable-root': {
            tableLayout: 'fixed',
            width: 'auto',
            minWidth: `${200 + 250 + (days.length * 70) + 80 + 60}px`
          },
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#c1c1c1',
            borderRadius: '4px',
            '&:hover': {
              background: '#a8a8a8',
            },
          },
        }}
      >
        <Table sx={{ tableLayout: 'fixed', width: 'auto' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '200px', minWidth: '200px' }}>Catégorie</TableCell>
              <TableCell sx={{ width: '250px', minWidth: '250px' }}>Détails / Commentaires</TableCell>
              {dayHeaders}
              <TableCell align="center" sx={{ width: '80px', minWidth: '80px' }}>Total</TableCell>
              <TableCell align="center" sx={{ width: '60px', minWidth: '60px' }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows}
            <TableRow>
              <TableCell sx={{ border: 'none', py: 0.5, textAlign: 'center', width: '200px' }}>
                <IconButton
                  color="primary"
                  onClick={onAddCategory}
                  sx={{
                    background: '#f8f9fa',
                    border: '1px dashed #ccc',
                    borderRadius: 1,
                    width: '100%',
                    height: 32,
                    '&:hover': { 
                      background: '#e9ecef',
                      borderColor: '#8e4890'
                    }
                  }}
                  size="small"
                >
                  <AddIcon fontSize="small" sx={{ color: '#666' }} />
                </IconButton>
              </TableCell>
              <TableCell colSpan={days.length + 2} sx={{ border: 'none' }}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Typography sx={{ fontWeight: 400, color: '#666', mt: 1, textAlign: 'right', fontSize: '0.9rem' }}>
        Total {label} : {getSectionTotal().toFixed(2)}
      </Typography>
      <Divider sx={{ mt: 2 }} />
    </div>
  );
} 