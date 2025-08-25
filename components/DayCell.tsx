import { FC, useMemo, useCallback, memo, useState, useEffect, useRef, forwardRef } from "react";
import Autocomplete from '@mui/material/Autocomplete';
import Popper from '@mui/material/Popper';
import CheckIcon from '@mui/icons-material/Check';
import { isValidDayValue } from '../constants/validation';
import { ALLOWED_DAY_VALUES } from '../constants/ui';

type Category = { id: number; label: string };

type DayCellProps = {
  value: string;
  record: Category;
  day: Date;
  onCellChange: (catId: number, date: string, value: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  options?: string[]; // options dynamiques filtrées selon capacité restante
  pending?: boolean; // nouvelle indication valeur non sauvegardée
};

const DayCell: FC<DayCellProps> = memo(({ value, record, day, onCellChange, readOnly = false, invalid, options, pending }) => {
  const isWeekend = useMemo(() => day.getDay() === 0 || day.getDay() === 6, [day]);
  const dayString = useMemo(() => {
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }, [day]);
  const fullDayName = useMemo(() => day.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), [day]);
  const [draft, setDraft] = useState<string>(value);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const inputAnchorRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Sync external value changes
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const isValueValid = useMemo(() => draft === '' || isValidDayValue(draft), [draft]);

  const commit = useCallback(() => {
    if (readOnly || isWeekend) return;
    if (draft === '') {
      onCellChange(record.id, dayString, '');
      return;
    }
    if (!isValidDayValue(draft)) {
      // revert to last valid external value
      setDraft(value);
      return;
    }
    // normaliser 2 décimales max sans zéros inutiles
    const num = Number(draft);
    const normalized = num.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
    setDraft(normalized);
    onCellChange(record.id, dayString, normalized);
  }, [draft, readOnly, isWeekend, onCellChange, record.id, dayString, value]);

  // display helper: show raw numeric values only
  const pretty = useCallback((v: string) => v, []);

  // options provided (possibly filtered by remaining capacity)
  const listOptions = options ?? ALLOWED_DAY_VALUES;

  // sorted numeric options for arrow-key stepping
  const numericOptions = useMemo(() => {
    const arr = listOptions.map((s) => Number(s)).filter(n => !isNaN(n));
    const uniq = Array.from(new Set(arr)).sort((a,b)=>a-b);
    // include current numeric if not present
    const cur = draft === '' ? null : Number(draft);
    if (cur != null && !isNaN(cur) && !uniq.includes(cur)) uniq.push(cur);
    return uniq.sort((a,b)=>a-b);
  }, [listOptions, draft]);

  // do not show dropdown when no selection is possible (e.g., total already 1 and current cell empty)
  const canOpen = useMemo(() => !(listOptions.length === 0 && (draft === '' || draft == null)), [listOptions.length, draft]);

  // Custom Popper anchored to the 48px cell to ensure perfect centering
  const CellPopper = forwardRef<HTMLDivElement, any>(function CellPopper(props, ref) {
    return (
      <Popper
        {...props}
        ref={ref}
        anchorEl={inputAnchorRef.current}
        placement="bottom"
        modifiers={[
          { name: 'offset', options: { offset: [0, 8] } },
          { name: 'flip', enabled: false },
        ]}
  open={props.open}
      />
    );
  });

  return (
    <>
  <span ref={anchorRef} style={{ display: 'inline-block', width: '48px', position: 'relative' }}>
        {/* Centered placeholder line when empty and editable */}
        {(!isWeekend && !readOnly && (draft === '' || draft == null)) && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              color: '#bbb',
              fontSize: 12,
              lineHeight: 1,
              userSelect: 'none'
            }}
          >
            —
          </span>
        )}
        <Autocomplete
          freeSolo
          disableClearable
          options={listOptions}
          disablePortal={false}
          value={isWeekend ? '' : (draft)}
          open={isOpen && canOpen}
          onOpen={() => { if (canOpen) setIsOpen(true); }}
          onClose={() => setIsOpen(false)}
          // do not auto-open on focus; we control open state
          openOnFocus={false}
          PopperComponent={CellPopper as any}
          onInputChange={(_, newInput) => {
            const raw = newInput.replace(',', '.');
            if (raw === '' || /^\d*(?:[\.,]\d{0,2})?$/.test(raw)) {
              setDraft(raw);
            }
          }}
          onChange={(_, newValue) => {
            if (typeof newValue === 'string') {
              setDraft(newValue);
              // commit immédiatement sur sélection option
              const normalized = newValue === '' ? '' : Number(newValue).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
              if (!readOnly && !isWeekend) {
                onCellChange(record.id, dayString, normalized === '' ? '' : normalized);
              }
            }
          }}
          onBlur={commit}
          disabled={isWeekend || readOnly}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props as any;
            const isSelected = draft !== '' && Number(option) === Number(draft);
            return (
              <li
                key={key}
                {...optionProps}
                style={{
                  fontSize: 12,
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 4,
                  minHeight: 28
                }}
              >
                <span>{pretty(String(option))}</span>
                {isSelected && <CheckIcon sx={{ fontSize: 16, color: '#894991', ml: 1 }} />}
              </li>
            );
          }}
          slotProps={{
            paper: { sx: {
              width: 'unset', minWidth: 72, py: 0.25, mt: 0.5,
              position: 'relative',
              borderRadius: 4,
              border: '1px solid #e0e0e0',
              boxShadow: '0 6px 14px rgba(0,0,0,0.08)',
              animation: 'popIn 100ms ease-out',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: 8,
                height: 8,
                backgroundColor: 'background.paper',
                borderLeft: '1px solid #e0e0e0',
                borderTop: '1px solid #e0e0e0',
                boxShadow: '0 -1px 0 0 rgba(0,0,0,0.025)'
              }
            } },
            popper: { sx: { zIndex: 1400 } },
            // listbox is not in TS typings; cast keeps sx customization
            listbox: { sx: {
              p: 0.25,
              '& .MuiAutocomplete-option': {
                mx: 0.5,
                borderRadius: 1,
              },
              '& .MuiAutocomplete-option.Mui-focused': {
                backgroundColor: '#f4f6f8'
              },
              '& .MuiAutocomplete-option[aria-selected="true"]': {
                backgroundColor: '#eef2f6'
              }
            } } as any
          } as any}
          renderInput={(params) => (
            <div
              ref={(el) => {
                inputAnchorRef.current = el;
                const r: any = params.InputProps.ref;
                if (typeof r === 'function') r(el);
                else if (r && typeof r === 'object') r.current = el;
              }}
              style={{ position:'relative', width: '48px', margin: '0 auto' }}
            >
              <input
                type="text"
                {...params.inputProps}
                placeholder={isWeekend ? 'WE' : ''}
                readOnly={false}
                aria-label={`Heures pour ${fullDayName}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commit();
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    setDraft(value);
                    (e.target as HTMLInputElement).blur();
                  } else if (!readOnly && !isWeekend && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    if (!canOpen) return; // no stepping when nothing can be selected
                    const cur = draft === '' ? 0 : Number(draft);
                    if (e.key === 'ArrowUp') {
                      // next higher allowed value, max 1
                      const next = numericOptions.find(n => n > cur);
                      if (typeof next === 'number' && next <= 1) {
                        const norm = next.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
                        setDraft(norm);
                        onCellChange(record.id, dayString, norm);
                      }
                    } else if (e.key === 'ArrowDown') {
                      // next lower allowed value, min 0
                      const reversed = [...numericOptions].reverse();
                      const prev = reversed.find(n => n < cur);
                      if (typeof prev === 'number' && prev >= 0) {
                        const norm = prev.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
                        setDraft(norm);
                        onCellChange(record.id, dayString, norm);
                      } else if (cur > 0) {
                        setDraft('');
                        onCellChange(record.id, dayString, '');
                      }
                    }
                  }
                }}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  height: 28,
                  padding: 0,
                  backgroundColor: isWeekend ? '#eee' : 'transparent',
                  cursor: isWeekend || readOnly ? 'not-allowed' : 'text',
                  color: (invalid || !isValueValid) ? '#b71c1c' : (isWeekend ? '#666' : (draft ? '#222' : 'inherit')),
                  borderBottom: (invalid || !isValueValid) ? '2px solid #d32f2f' : 'none',
                  fontWeight: (invalid ? 600 : (draft ? 600 : 500)),
                  borderRadius: 4,
                  transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: 'none'
                }}
                inputMode="decimal"
                pattern="^\\d*(?:[\\.,]\\d{0,2})?$"
                title={draft ? `${fullDayName} — ${draft}` : fullDayName}
              />
            </div>
          )}
          sx={{
            width: '48px',
            display: 'block',
            mx: 'auto',
            '& .MuiAutocomplete-endAdornment': { display:'none' },
            '& .MuiOutlinedInput-root': { padding:0 },
            '& input': { textAlign: 'center' }
          }}
        />
      </span>
      <style jsx>{`
        @keyframes pulseBorder {
          0% { box-shadow: 0 0 0 0 rgba(211,47,47,0.6); }
          70% { box-shadow: 0 0 0 6px rgba(211,47,47,0); }
          100% { box-shadow: 0 0 0 0 rgba(211,47,47,0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: translateY(-4px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
});

DayCell.displayName = 'DayCell';

export default DayCell; 