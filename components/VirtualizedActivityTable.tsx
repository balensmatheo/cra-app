import { FC, useMemo, useCallback, useRef, useEffect } from "react";
import { FixedSizeList as List } from 'react-window';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { type SectionKey } from '../constants/categories';
import { VIRTUALIZATION_THRESHOLD, ROW_HEIGHT } from '../constants/ui';
import ActivityRow from './ActivityRow';

type Category = { id: number; label: string };

type VirtualizedActivityTableProps = {
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



const VirtualizedActivityTable: FC<VirtualizedActivityTableProps> = ({
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
}) => {
  const localTableRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);

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
        maxWidth: '70px',
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #e9ecef',
        fontWeight: 600,
        fontSize: '0.875rem',
        color: '#495057',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {d.getDate()}<br />
          <span style={{ fontSize: 10, color: '#6c757d' }}>{d.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
        </div>
      </TableCell>
    )), [days]);

  // Fonction de rendu pour react-window
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const category = categories[index];
    if (!category) return null;

    return (
      <div style={style}>
        <ActivityRow
          sectionKey={sectionKey}
          category={category}
          index={index}
          days={days}
          data={data}
          categoryOptions={categoryOptions}
          onCategoryChange={handleCategoryChange}
          onCellChange={handleCellChange}
          onCommentChange={handleCommentChange}
          onDeleteCategory={handleDeleteCategory}
          getRowTotal={getRowTotal}
          categoriesLength={categories.length}
        />
      </div>
    );
  }, [sectionKey, categories, days, data, categoryOptions, handleCategoryChange, handleCellChange, handleCommentChange, handleDeleteCategory, getRowTotal]);

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

  // Décider si on utilise la virtualisation
  const shouldVirtualize = categories.length > VIRTUALIZATION_THRESHOLD;

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
            width: 'auto',
            minWidth: `${200 + 250 + (days.length * 70) + 80}px`,
            '@media (max-width: 768px)': {
              minWidth: `${150 + 200 + (days.length * 60) + 70}px`,
            }
          },
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
        <Table sx={{ tableLayout: 'fixed', width: 'auto' }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
              <TableCell sx={{ 
                width: '200px', 
                minWidth: '200px',
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
                width: '250px', 
                minWidth: '250px',
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #e9ecef',
                borderRight: '1px solid #e9ecef',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#495057',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Détails / Commentaires
              </TableCell>
              {dayHeaders}
              <TableCell align="center" sx={{ 
                width: '80px', 
                minWidth: '80px',
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #e9ecef',
                borderRight: '1px solid #e9ecef',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#495057',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Total
              </TableCell>
              <TableCell align="center" sx={{ 
                width: '60px', 
                minWidth: '60px',
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #e9ecef',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: '#495057',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shouldVirtualize ? (
              <TableRow>
                <TableCell colSpan={days.length + 4} sx={{ padding: 0, border: 'none' }}>
                  <List
                    ref={listRef}
                    height={Math.min(categories.length * ROW_HEIGHT, 400)}
                    itemCount={categories.length}
                    itemSize={ROW_HEIGHT}
                    width="100%"
                  >
                    {Row}
                  </List>
                </TableCell>
              </TableRow>
            ) : (
              // Rendu normal pour moins de 30 lignes
              categories.map((cat, index) => (
                <ActivityRow
                  key={`${sectionKey}-${cat.id}`}
                  sectionKey={sectionKey}
                  category={cat}
                  index={index}
                  days={days}
                  data={data}
                  categoryOptions={categoryOptions}
                  onCategoryChange={handleCategoryChange}
                  onCellChange={handleCellChange}
                  onCommentChange={handleCommentChange}
                  onDeleteCategory={handleDeleteCategory}
                  getRowTotal={getRowTotal}
                  categoriesLength={categories.length}
                />
              ))
            )}
            <TableRow>
              <TableCell sx={{ 
                border: 'none', 
                py: 1, 
                textAlign: 'center', 
                width: '200px',
                borderRight: '1px solid #e9ecef'
              }}>
                <Tooltip title="Ajouter une nouvelle ligne" arrow>
                  <IconButton
                    color="primary"
                    onClick={onAddCategory}
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
                  >
                    <AddIcon fontSize="small" sx={{ color: '#894991' }} />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell colSpan={days.length + 2} sx={{ border: 'none' }}></TableCell>
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
};

export default VirtualizedActivityTable; 