import { FC, useMemo, useCallback, memo } from "react";
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

type Category = { id: number; label: string };

type CategoryCellProps = {
  value: string;
  record: Category;
  data: { [catId: number]: Record<string, string | undefined> };
  categoryOptions: string[];
  onCategoryChange: (catId: number, value: string) => void;
};

const CategoryCell: FC<CategoryCellProps> = memo(({ value, record, data, categoryOptions, onCategoryChange }) => {
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
      aria-label={`Sélectionner une catégorie pour ${record.label || 'cette ligne'}`}
      role="combobox"
      aria-expanded={false}
      aria-haspopup="listbox"
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

export default CategoryCell; 