import { FC, useState, useEffect, useCallback, memo, useRef } from "react";
import TextField from '@mui/material/TextField';
import { useDebounce } from '../hooks/useDebounce';
import { DEBOUNCE_DELAY } from '../constants/ui';

type Category = { id: number; label: string };

type CommentCellProps = {
  value: string;
  record: Category;
  onCommentChange: (catId: number, value: string) => void;
  readOnly?: boolean;
  pending?: boolean;
};

const CommentCell: FC<CommentCellProps> = memo(({ value, record, onCommentChange, readOnly = false, pending = false }) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedLocalValue = useDebounce(localValue, DEBOUNCE_DELAY);
  
  // Synchroniser la valeur locale avec la valeur externe
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Utiliser la valeur debouncée pour déclencher la mise à jour externe
  const lastEmittedRef = useRef<string>(value);
  useEffect(() => {
    if (debouncedLocalValue !== lastEmittedRef.current) {
      lastEmittedRef.current = debouncedLocalValue;
      if (debouncedLocalValue !== value) {
        onCommentChange(record.id, debouncedLocalValue);
      }
    }
  }, [debouncedLocalValue, value, onCommentChange, record.id]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
  }, []);
  
  return (
    <TextField
      value={localValue}
      onChange={handleChange}
      placeholder="Nom du client, activité, ..."
      aria-label={`Commentaire pour ${record.label || 'cette ligne'}`}
      role="textbox"
      sx={{ 
        width: '100%',
        backgroundColor: 'transparent',
        '& .MuiInputBase-root': {
          height: 30,
          overflow: 'hidden',
          px: 0,
          backgroundColor: 'transparent',
        },
        '& input': {
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          fontSize: 13,
          color: '#111827',
          padding: 0,
        }
      }}
      size="small"
      disabled={readOnly}
      variant="standard"
      InputProps={{ disableUnderline: true }}
    />
  );
});

CommentCell.displayName = 'CommentCell';

export default CommentCell; 