import { FC, memo, useCallback, useState } from "react";
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import CircularProgress from '@mui/material/CircularProgress';
import { type SectionKey } from '../constants/categories';
import CategoryCell from './CategoryCell';
import CommentCell from './CommentCell';
import DayCell from './DayCell';
import { ALLOWED_DAY_VALUES } from '../constants/ui';

type Category = { id: number; label: string };

type ActivityRowProps = {
  sectionKey: SectionKey;
  category: Category;
  index: number;
  days: Date[];
  data: { [catId: number]: Record<string, string | undefined> };
  totalsByDay: Record<string, number>;
  categoryOptions: string[];
  onCategoryChange: (catId: number, value: string) => void;
  onCellChange: (catId: number, date: string, value: string) => void;
  onCommentChange: (catId: number, value: string) => void;
  onDeleteCategory: (catId: number) => void;
  getRowTotal: (catId: number) => number;
  categoriesLength: number;
  readOnly?: boolean;
  invalidDays?: Set<string>;
  pendingMatrix?: Record<number, Record<string, boolean>>; // rowId -> date -> pending
  pendingComments?: Record<number, boolean>;
};

const ActivityRow: FC<ActivityRowProps> = memo(({
  sectionKey,
  category,
  index,
  days,
  data,
  categoryOptions,
  totalsByDay,
  onCategoryChange,
  onCellChange,
  onCommentChange,
  onDeleteCategory,
  getRowTotal,
  categoriesLength,
  readOnly = false,
  invalidDays,
  pendingMatrix,
  pendingComments,
}) => {
  const [deleting, setDeleting] = useState(false);
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
    if (readOnly) return;
    setDeleting(true);
    try {
      onDeleteCategory(catId);
    } finally {
      // brief visual feedback even if sync
      setTimeout(() => setDeleting(false), 700);
    }
  }, [onDeleteCategory, readOnly]);

  return (
    <TableRow sx={{ 
      backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa',
      '&:hover': {
        backgroundColor: '#f8f9fa',
        transition: 'background-color 0.2s ease'
      }
    }}>
      <TableCell sx={{ 
        width: '200px', 
        minWidth: '200px',
        maxWidth: '200px',
        borderBottom: '1px solid #e9ecef',
        borderRight: '1px solid #e9ecef'
       }}>
        <CategoryCell
          value={category.label}
          record={category}
          data={data}
          categoryOptions={categoryOptions}
          onCategoryChange={handleCategoryChange}
          readOnly={readOnly}
        />
      </TableCell>
  <TableCell sx={{ 
  width: '200px', 
  minWidth: '200px',
  maxWidth: '200px',
        borderBottom: '1px solid #e9ecef',
        borderRight: '1px solid #e9ecef'
      }}>
        <CommentCell
          value={data[category.id]?.comment || ""}
          record={category}
          onCommentChange={handleCommentChange}
          readOnly={readOnly}
      pending={false}
        />
      </TableCell>
      {days.map((d) => {
        const dayKey = d.toISOString().slice(0,10);
        // calcul somme déjà utilisée ce jour sur toutes les catégories (dans data structure) sauf cette catégorie courante
  const used = totalsByDay?.[dayKey] || 0;
        const currentVal = data[category.id]?.[dayKey];
        const currentNum = currentVal ? Number(currentVal) : 0;
  const remaining = Math.max(0, 1 - (used - currentNum)); // capacité restante globale si on change cette cellule
        // filtrer les options <= remaining et != valeur actuelle (toujours inclure valeur actuelle pour l'afficher)
        const dynamicOptions = ALLOWED_DAY_VALUES.filter(v => Number(v) <= remaining || v === currentVal);
        return (
        <TableCell key={dayKey} align="center" sx={{ 
          px: 0, 
          width: '48px', 
          minWidth: '48px',
          maxWidth: '48px',
          borderBottom: '1px solid #e9ecef',
          borderRight: '1px solid #e9ecef',
          backgroundColor: (d.getDay() === 0 || d.getDay() === 6) ? '#f8f9fa' : (invalidDays?.has(dayKey) ? '#ffe5e5' : 'inherit'),
          position: 'relative'
        }}>
          <DayCell
            value={currentVal || ""}
            record={category}
            day={d}
            onCellChange={handleCellChange}
            readOnly={readOnly}
            invalid={invalidDays?.has(dayKey)}
            options={dynamicOptions}
            pending={false}
          />
        </TableCell>
      );})}
      <TableCell align="center" sx={{ 
        fontWeight: 600, 
        color: "#894991", 
        width: '72px', 
        minWidth: '72px',
        borderBottom: '1px solid #e9ecef',
        borderRight: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa'
       }}>
        {getRowTotal(category.id).toFixed(2)}
      </TableCell>
      <TableCell align="center" sx={{ 
        width: '44px', 
        minWidth: '44px',
        maxWidth: '44px',
        p: 0,
        borderBottom: '1px solid #e9ecef'
      }}>
  <Tooltip title={readOnly ? 'Lecture seule' : (deleting ? 'Suppression…' : 'Supprimer cette ligne')} arrow>
          <span>
            <IconButton
              color="error"
              size="small"
        onClick={() => handleDeleteCategory(category.id)}
        disabled={readOnly || deleting}
              aria-label={`Supprimer la ligne ${category.label || 'sans nom'}`}
              sx={{
                m: '2px',
                width: 32,
                height: 32,
                '&:hover': {
                  backgroundColor: '#ffebee',
                  transform: 'scale(1.1)',
                  transition: 'all 0.2s ease'
                },
                '&.Mui-disabled': {
                  opacity: 0.3
                }
              }}
            >
        {deleting ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

ActivityRow.displayName = 'ActivityRow';

export default ActivityRow; 