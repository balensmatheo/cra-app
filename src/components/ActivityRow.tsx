import { FC, memo, useCallback } from "react";
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import { type SectionKey } from '../constants/categories';
import CategoryCell from './CategoryCell';
import CommentCell from './CommentCell';
import DayCell from './DayCell';

type Category = { id: number; label: string };

type ActivityRowProps = {
  sectionKey: SectionKey;
  category: Category;
  index: number;
  days: Date[];
  data: { [catId: number]: Record<string, string | undefined> };
  categoryOptions: string[];
  onCategoryChange: (catId: number, value: string) => void;
  onCellChange: (catId: number, date: string, value: string) => void;
  onCommentChange: (catId: number, value: string) => void;
  onDeleteCategory: (catId: number) => void;
  getRowTotal: (catId: number) => number;
  categoriesLength: number;
};

const ActivityRow: FC<ActivityRowProps> = memo(({
  sectionKey,
  category,
  index,
  days,
  data,
  categoryOptions,
  onCategoryChange,
  onCellChange,
  onCommentChange,
  onDeleteCategory,
  getRowTotal,
  categoriesLength,
}) => {
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
        borderBottom: '1px solid #e9ecef',
        borderRight: '1px solid #e9ecef'
      }}>
        <CategoryCell
          value={category.label}
          record={category}
          data={data}
          categoryOptions={categoryOptions}
          onCategoryChange={handleCategoryChange}
        />
      </TableCell>
      <TableCell sx={{ 
        width: '250px', 
        minWidth: '250px',
        borderBottom: '1px solid #e9ecef',
        borderRight: '1px solid #e9ecef'
      }}>
        <CommentCell
          value={data[category.id]?.comment || ""}
          record={category}
          onCommentChange={handleCommentChange}
        />
      </TableCell>
      {days.map((d) => (
        <TableCell key={d.toISOString().slice(0, 10)} align="center" sx={{ 
          px: 0.5, 
          width: '70px', 
          minWidth: '70px',
          maxWidth: '70px',
          borderBottom: '1px solid #e9ecef',
          borderRight: '1px solid #e9ecef',
          backgroundColor: (d.getDay() === 0 || d.getDay() === 6) ? '#f8f9fa' : 'inherit'
        }}>
          <DayCell
            value={data[category.id]?.[d.toISOString().slice(0, 10)] || ""}
            record={category}
            day={d}
            onCellChange={handleCellChange}
          />
        </TableCell>
      ))}
      <TableCell align="center" sx={{ 
        fontWeight: 600, 
        color: "#894991", 
        width: '80px', 
        minWidth: '80px',
        borderBottom: '1px solid #e9ecef',
        borderRight: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa'
      }}>
        {getRowTotal(category.id).toFixed(2)}
      </TableCell>
      <TableCell align="center" sx={{ 
        width: '60px', 
        minWidth: '60px',
        borderBottom: '1px solid #e9ecef'
      }}>
        <Tooltip title="Supprimer cette ligne" arrow>
          <span>
            <IconButton
              color="error"
              size="small"
              onClick={() => handleDeleteCategory(category.id)}
              disabled={categoriesLength === 1}
              aria-label={`Supprimer la ligne ${category.label || 'sans nom'}`}
              sx={{
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
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

ActivityRow.displayName = 'ActivityRow';

export default ActivityRow; 