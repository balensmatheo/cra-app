import { FC, useMemo, useCallback, memo } from "react";
import Autocomplete from '@mui/material/Autocomplete';
import Tooltip from '@mui/material/Tooltip';
import { ALLOWED_DAY_VALUES } from '../constants/ui';
import { isValidDayValue } from '../constants/validation';

type Category = { id: number; label: string };

type DayCellProps = {
  value: string;
  record: Category;
  day: Date;
  onCellChange: (catId: number, date: string, value: string) => void;
};

const DayCell: FC<DayCellProps> = memo(({ value, record, day, onCellChange }) => {
  const isWeekend = useMemo(() => day.getDay() === 0 || day.getDay() === 6, [day]);
  const isValid = useMemo(() => isValidDayValue(value), [value]);
  const dayString = useMemo(() => day.toISOString().slice(0, 10), [day]);
  const fullDayName = useMemo(() => day.toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), [day]);
  
  const handleChange = useCallback((_: any, newValue: string | null) => {
    onCellChange(record.id, dayString, newValue || "");
  }, [record.id, dayString, onCellChange]);
  
  const handleInputChange = useCallback((_: any, newInputValue: string) => {
    // Ne déclencher que si la valeur est valide ou vide
    if (newInputValue === "" || isValidDayValue(newInputValue)) {
      onCellChange(record.id, dayString, newInputValue);
    }
  }, [record.id, dayString, onCellChange]);
  
  return (
    <Tooltip 
      title={isWeekend ? `${fullDayName} (Weekend)` : fullDayName} 
      arrow
      placement="top"
    >
      <Autocomplete
        freeSolo
        options={ALLOWED_DAY_VALUES}
        value={value}
        onChange={handleChange}
        onInputChange={handleInputChange}
        disabled={isWeekend}
        aria-label={`Heures pour ${fullDayName} (valeurs autorisées: 0.25, 0.5, 0.75, 1)`}
        role="combobox"
        aria-expanded={false}
        aria-haspopup="listbox"
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
          '& .MuiOutlinedInput-root': {
            borderColor: isValid === false ? 'red' : undefined,
            '&:hover': {
              borderColor: isValid === false ? 'red' : undefined,
            },
            '&.Mui-focused': {
              borderColor: isValid === false ? 'red' : undefined,
            },
          },
        }}
        renderInput={(params) => (
          <div ref={params.InputProps.ref}>
            <input
              type="text"
              {...params.inputProps}
              placeholder={isWeekend ? "WE" : ""}
              style={{
                width: '100%',
                textAlign: 'center',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                height: 32,
                padding: '4px',
                backgroundColor: 'transparent',
                color: isValid === false ? 'red' : (isWeekend ? '#666' : 'inherit'),
              }}
            />
          </div>
        )}
      />
    </Tooltip>
  );
});

DayCell.displayName = 'DayCell';

export default DayCell; 