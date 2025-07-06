import { FC, useState, useEffect, useCallback, memo } from "react";
import TextField from '@mui/material/TextField';
import { useDebounce } from '../hooks/useDebounce';
import { DEBOUNCE_DELAY } from '../constants/ui';

type Category = { id: number; label: string };

type CommentCellProps = {
  value: string;
  record: Category;
  onCommentChange: (catId: number, value: string) => void;
};

const CommentCell: FC<CommentCellProps> = memo(({ value, record, onCommentChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedLocalValue = useDebounce(localValue, DEBOUNCE_DELAY);
  
  // Synchroniser la valeur locale avec la valeur externe
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Utiliser la valeur debouncée pour déclencher la mise à jour externe
  useEffect(() => {
    if (debouncedLocalValue !== value) {
      onCommentChange(record.id, debouncedLocalValue);
    }
  }, [debouncedLocalValue, value, record.id, onCommentChange]);
  
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
      sx={{ width: '100%' }}
      size="small"
    />
  );
});

CommentCell.displayName = 'CommentCell';

export default CommentCell; 