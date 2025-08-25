import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import { useRef, useMemo, useCallback, useEffect } from "react";
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { type SectionKey } from '../constants/categories';
import { VIRTUALIZATION_THRESHOLD } from '../constants/ui';
import ActivityRow from './ActivityRow';
import VirtualizedActivityTable from './VirtualizedActivityTable';

type Category = { id: number; label: string };

type ActivityTableProps = {
  sectionKey: SectionKey;
  label: string;
  days: Date[];
  categories: Category[];
  data: { [catId: number]: Record<string, string | undefined> };
  totalsByDay: Record<string, number>;
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
  readOnly?: boolean;
  invalidDays?: Set<string>;
  pendingMatrix?: Record<number, Record<string, boolean>>; // rowId->date->pending
  pendingComments?: Record<number, boolean>;
};



export default function ActivityTable({
  sectionKey,
  label,
  days,
  categories,
  data,
  categoryOptions,
  totalsByDay,
  onCategoryChange,
  onCellChange,
  onAddCategory,
  onDeleteCategory,
  getRowTotal,
  getSectionTotal,
  onCommentChange,
  tableRef,
  onTableScroll,
  readOnly = false,
  invalidDays,
  pendingMatrix,
  pendingComments,
}: ActivityTableProps) {
  // Décider si on utilise la virtualisation (plus de 30 lignes)
  const shouldVirtualize = categories.length > VIRTUALIZATION_THRESHOLD;

  // Si on doit virtualiser, utiliser le composant virtualisé
  if (shouldVirtualize) {
    return (
      <VirtualizedActivityTable
        sectionKey={sectionKey}
        label={label}
        days={days}
        categories={categories}
        data={data}
  totalsByDay={totalsByDay}
        categoryOptions={categoryOptions}
        onCategoryChange={onCategoryChange}
        onCellChange={onCellChange}
        onAddCategory={onAddCategory}
        onDeleteCategory={onDeleteCategory}
        getRowTotal={getRowTotal}
        getSectionTotal={getSectionTotal}
        onCommentChange={onCommentChange}
        tableRef={tableRef}
        onTableScroll={onTableScroll}
        readOnly={readOnly}
  invalidDays={invalidDays}
      />
    );
  }

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
    days.map((d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${dd}`;
      return (
      <TableCell key={key} align="center" sx={{ 
        px: 0, 
        width: '48px', 
        minWidth: '48px',
        maxWidth: '48px',
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #e9ecef',
        fontWeight: 600,
        fontSize: '0.75rem',
        color: '#495057',
        textTransform: 'uppercase',
        letterSpacing: '0.25px'
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.1 }}>
          {d.getDate()}<br />
          <span style={{ fontSize: 9, color: '#6c757d' }}>{d.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span>
        </div>
      </TableCell>
    )}), [days]);

  // Memoize les lignes de données
  const tableRows = useMemo(() => 
  categories.map((cat, index) => (
      <ActivityRow
        key={`${sectionKey}-${cat.id}`}
        sectionKey={sectionKey}
        category={cat}
        index={index}
        days={days}
        data={data}
        categoryOptions={categoryOptions}
        totalsByDay={totalsByDay}
        onCategoryChange={handleCategoryChange}
        onCellChange={handleCellChange}
        onCommentChange={handleCommentChange}
        onDeleteCategory={handleDeleteCategory}
        getRowTotal={getRowTotal}
        categoriesLength={categories.length}
        readOnly={readOnly}
  invalidDays={invalidDays}
        pendingMatrix={pendingMatrix}
        pendingComments={pendingComments}
      />
    )), [sectionKey, categories, days, data, categoryOptions, handleCategoryChange, handleCellChange, handleCommentChange, handleDeleteCategory, getRowTotal]);

  // Appeler la fonction de ref pour enregistrer la référence
  useEffect(() => {
    if (tableRef && localTableRef.current) {
      tableRef(localTableRef.current);
    }
  }, [tableRef]);

  // Alternative: utiliser un callback ref pour une meilleure gestion
  const handleTableRef = useCallback((el: HTMLDivElement | null) => {
    localTableRef.current = el;
    if (tableRef && el) {
      tableRef(el);
    }
  }, [tableRef]);

  return (
    <div style={{ marginBottom: 6, position: 'relative', paddingBottom: 10 }}>
      {/* Header simplifié avec seulement le titre */}
      <Box sx={{ 
        mb: 2,
        pb: 1.5,
        borderBottom: '2px solid #e9ecef',
        backgroundColor: '#f8f9fa',
        px: 2,
        py: 1,
        borderRadius: '8px 8px 0 0'
      }}>
        <Typography variant="h5" sx={{ 
          color: "#894991", 
          fontWeight: 700,
          fontSize: '1.25rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {label}
        </Typography>
      </Box>

  <TableContainer 
        ref={handleTableRef} 
        onScroll={onTableScroll}
        sx={{ 
          maxHeight: '400px',
          overflow: 'auto',
          border: '1px solid #e9ecef',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          // Responsive design
          '@media (max-width: 768px)': {
            overflowX: 'scroll',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              height: '6px',
            },
          },
          '& .MuiTable-root': {
            tableLayout: 'fixed',
            width: `${200 + 200 + (days.length * 48) + 72 + 44}px`,
            minWidth: `${200 + 200 + (days.length * 48) + 72 + 44}px`,
            '@media (max-width: 768px)': {
              minWidth: `${200 + 200 + (days.length * 46) + 72 + 44}px`,
            }
          },
          // no extra right padding needed without sticky right columns
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f8f9fa',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#894991',
            borderRadius: '4px',
            '&:hover': {
              background: '#6a3a7a',
            },
          },
        }}
      >
    <Table sx={{ tableLayout: 'fixed', width: 'inherit', '& th, & td': { boxSizing: 'border-box' } }}>
      <colgroup>
      <col style={{ width: '200px' }} />
            <col style={{ width: '200px' }} />
            {days.map((_, i) => (
              <col key={`day-col-${i}`} style={{ width: '48px' }} />
            ))}
            <col style={{ width: '72px' }} />
            <col style={{ width: '44px' }} />
          </colgroup>
      <TableHead sx={{ position: 'sticky', top: 0, zIndex: 3, backgroundColor: '#f8f9fa' }}>
            <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
              <TableCell sx={{ 
                width: '200px', 
                minWidth: '200px',
                maxWidth: '200px',
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #e9ecef',
                borderRight: '1px solid #e9ecef',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#495057',
                textTransform: 'uppercase',
        letterSpacing: '0.5px'
              }}>
                Catégorie
              </TableCell>
              <TableCell sx={{ 
                width: '200px', 
                minWidth: '200px',
                maxWidth: '200px',
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #e9ecef',
                borderRight: '1px solid #e9ecef',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#495057',
                textTransform: 'uppercase',
        letterSpacing: '0.5px'
              }}>
                DETAILS
              </TableCell>
              {dayHeaders}
              <TableCell align="center" sx={{ 
                width: '72px', 
                minWidth: '72px',
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #e9ecef',
                borderRight: '1px solid #e9ecef',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: '#495057',
                textTransform: 'uppercase',
                letterSpacing: '0.25px',
                
              }}>
                Total
              </TableCell>
              <TableCell align="center" sx={{ 
                width: '44px', 
                minWidth: '44px',
                maxWidth: '44px',
                p: 0,
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #e9ecef'
              }}>
                {/* empty header for compact action column */}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows}
            <TableRow>
              <TableCell sx={{ 
                border: 'none', 
                py: 1, 
                textAlign: 'center', 
                width: '200px',
                borderRight: '1px solid #e9ecef'
              }}>
  <Tooltip title={readOnly ? 'Lecture seule' : 'Ajouter une nouvelle ligne'} arrow>
      <span>
      <IconButton
                    color="primary"
          onClick={readOnly ? undefined : onAddCategory}
                    aria-label="Ajouter une nouvelle ligne"
                    sx={{
                      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                      border: '2px dashed #894991',
                      borderRadius: '8px',
                      width: '100%',
                      height: 40,
                      '&:hover': { 
                        background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
                        borderColor: '#6a3a7a',
                        transform: 'scale(1.02)',
                        transition: 'all 0.2s ease'
                      }
                    }}
                    size="small"
          disabled={readOnly}
                  >
                    <AddIcon fontSize="small" sx={{ color: '#894991' }} />
                  </IconButton>
      </span>
                </Tooltip>
              </TableCell>
              <TableCell colSpan={days.length + 3} sx={{ border: 'none' }}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Total en bas à droite */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        mt: 2,
        pr: 1
      }}>
        <Typography sx={{ 
          fontWeight: 600, 
          color: '#495057', 
          fontSize: '0.9rem',
          backgroundColor: '#f8f9fa',
          px: 1.5,
          py: 0.5,
          borderRadius: '4px',
          border: '1px solid #e9ecef',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          Total {label}: {getSectionTotal().toFixed(2)}
        </Typography>
      </Box>

      <Divider sx={{ mt: 2, borderColor: '#e9ecef' }} />
    </div>
  );
} 