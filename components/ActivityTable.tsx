import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Typography, Divider, IconButton, Select, MenuItem, TextField, Autocomplete, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { FC, useMemo, useRef, useCallback, useEffect, useState, memo } from 'react';

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
  const rowData = useMemo(() => (typeof record.id === 'number' ? data[record.id] || {} : {}), [record.id, data]);
  const hasData = useMemo(() => Object.entries(rowData).some(([k, v]) => k !== 'comment' && v) || rowData.comment, [rowData]);
  const isInvalid = hasData && !value;
  
  const handleChange = useCallback((e: any) => { 
    onCategoryChange(record.id, e.target.value); 
  }, [record.id, onCategoryChange]);
  
  return (
    <Select
      value={value}
      onChange={handleChange}
      displayEmpty
      renderValue={(selected) => (
        selected ? (
          <Chip 
            label={selected} 
            size="small" 
            sx={{ 
              backgroundColor: '#f0f8ff',
              color: '#1976d2',
              fontWeight: 500,
              '& .MuiChip-label': { px: 1 }
            }} 
          />
        ) : (
          <span style={{ color: '#999', fontStyle: 'italic' }}>
            Choisir une catégorie
          </span>
        )
      )}
      size="small"
      sx={{ 
        width: '100%',
        '& .MuiOutlinedInput-root': {
          borderColor: isInvalid ? '#d32f2f' : undefined,
          backgroundColor: isInvalid ? '#fff5f5' : undefined,
          '&:hover': {
            borderColor: isInvalid ? '#d32f2f' : undefined,
          },
          '&.Mui-focused': {
            borderColor: isInvalid ? '#d32f2f' : undefined,
          }
        },
        '& .MuiSelect-select': {
          py: 0.5,
          px: 1
        }
      }}
      error={isInvalid}
    >
      <MenuItem value="">
        <em>Choisir une catégorie</em>
      </MenuItem>
      {categoryOptions.map((opt) => (
        <MenuItem key={opt} value={opt} sx={{ py: 0.5 }}>
          {opt}
        </MenuItem>
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => { 
    setLocalValue(value); 
  }, [value]);
  
  useEffect(() => () => { 
    if (timeoutRef.current) clearTimeout(timeoutRef.current); 
  }, []);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { 
      onCommentChange(record.id, newValue); 
    }, 300);
  }, [record.id, onCommentChange]);
  
  return (
    <TextField 
      value={localValue} 
      onChange={handleChange} 
      placeholder="Nom du client, activité, ..." 
      size="small"
      multiline
      maxRows={2}
      sx={{ 
        width: '100%',
        '& .MuiOutlinedInput-root': {
          fontSize: '0.875rem',
          '& fieldset': {
            borderColor: '#e0e0e0',
          },
          '&:hover fieldset': {
            borderColor: '#bdbdbd',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#1976d2',
          }
        },
        '& .MuiInputBase-input': {
          py: 0.5,
          px: 1
        }
      }}
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
  
  const handleChange = useCallback((_: any, newValue: string | null) => { 
    onCellChange(record.id, dayString, newValue || ""); 
  }, [record.id, dayString, onCellChange]);
  
  const handleInputChange = useCallback((_: any, newInputValue: string) => { 
    if (newInputValue === "" || allowedDayValues.includes(newInputValue)) { 
      onCellChange(record.id, dayString, newInputValue); 
    } 
  }, [record.id, dayString, onCellChange]);
  
  if (isWeekend) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          border: '1px solid #e0e0e0',
          borderRadius: 1,
          color: '#999',
          fontSize: '0.75rem',
          fontWeight: 500
        }}
      >
        WE
      </Box>
    );
  }
  
  return (
    <Autocomplete
      freeSolo
      options={allowedDayValues}
      value={value}
      onChange={handleChange}
      onInputChange={handleInputChange}
      sx={{ 
        width: '100%',
        '& .MuiOutlinedInput-root': {
          borderColor: isValid === false ? '#d32f2f' : '#e0e0e0',
          color: isValid === false ? '#d32f2f' : 'inherit',
          fontSize: '0.875rem',
          height: 32,
          minHeight: 32,
          '&:hover': {
            borderColor: isValid === false ? '#d32f2f' : '#bdbdbd',
          },
          '&.Mui-focused': {
            borderColor: isValid === false ? '#d32f2f' : '#1976d2',
          }
        },
        '& .MuiAutocomplete-input': {
          textAlign: 'center',
          padding: '4px 8px !important',
          fontSize: '0.875rem'
        },
        '& .MuiAutocomplete-endAdornment': { 
          display: 'none' 
        }
      }}
      renderInput={(params) => (
        <TextField 
          {...params} 
          error={isValid === false}
          variant="outlined" 
          size="small" 
          placeholder="-" 
          inputProps={{ 
            ...params.inputProps, 
            style: { 
              textAlign: 'center', 
              padding: '4px 8px',
              fontSize: '0.875rem',
              height: '24px'
            } 
          }} 
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

  const rows = useMemo(() =>
    categories.map((cat) => {
      const row = data[cat.id] || {};
      const obj: any = { id: cat.id, label: cat.label, comment: row.comment || '' };
      days.forEach((d) => { 
        obj[d.toISOString().slice(0, 10)] = row[d.toISOString().slice(0, 10)] || ''; 
      });
      return obj;
    }), [categories, data, days]);

  const columns = useMemo<GridColDef[]>(() => {
    const dayCols: GridColDef[] = days.map((d) => ({
      field: d.toISOString().slice(0, 10),
      width: 80,
      headerAlign: 'center',
      align: 'center',
      renderHeader: () => (
        <Box sx={{ 
          textAlign: 'center',
          py: 1,
          px: 0.5,
          backgroundColor: '#f8f9fa',
          borderBottom: '2px solid #e9ecef',
          minHeight: '50px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Box sx={{ 
            fontSize: '1rem', 
            fontWeight: 700,
            color: '#333',
            lineHeight: 1.2,
            mb: 0.5
          }}>
            {d.getDate()}
          </Box>
          <Box sx={{ 
            fontSize: '0.7rem', 
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            fontWeight: 500,
            backgroundColor: '#fff',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            border: '1px solid #e0e0e0'
          }}>
            {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
          </Box>
        </Box>
      ),
      renderCell: (params) => (
        <DayCell 
          value={params.value || ''} 
          record={{ id: params.row.id, label: params.row.label }} 
          day={d} 
          onCellChange={handleCellChange} 
        />
      ),
    }));
    
    return [
      {
        field: 'label',
        headerName: 'Catégorie',
        width: 220,
        renderHeader: () => (
          <Box sx={{ 
            textAlign: 'center',
            py: 1,
            px: 0.5,
            backgroundColor: '#f8f9fa',
            borderBottom: '2px solid #e9ecef',
            minHeight: '50px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Box sx={{ 
              fontSize: '0.85rem', 
              fontWeight: 700,
              color: '#333',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Catégorie
            </Box>
          </Box>
        ),
        renderCell: (params) => (
          <CategoryCell
            value={params.value}
            record={{ id: params.row.id, label: params.row.label }}
            data={data}
            categoryOptions={categoryOptions}
            onCategoryChange={handleCategoryChange}
          />
        ),
      },
      {
        field: 'comment',
        headerName: 'Détails / Commentaires',
        width: 280,
        renderHeader: () => (
          <Box sx={{ 
            textAlign: 'center',
            py: 1,
            px: 0.5,
            backgroundColor: '#f8f9fa',
            borderBottom: '2px solid #e9ecef',
            minHeight: '50px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Box sx={{ 
              fontSize: '0.8rem', 
              fontWeight: 700,
              color: '#333',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              lineHeight: 1.2
            }}>
              Détails /<br />Commentaires
            </Box>
          </Box>
        ),
        renderCell: (params) => (
          <CommentCell 
            value={params.value} 
            record={{ id: params.row.id, label: params.row.label }} 
            onCommentChange={handleCommentChange} 
          />
        ),
      },
      ...dayCols,
      {
        field: 'total',
        headerName: 'Total',
        width: 90,
        headerAlign: 'center',
        align: 'center',
        renderHeader: () => (
          <Box sx={{ 
            textAlign: 'center',
            py: 1,
            px: 0.5,
            backgroundColor: '#f8f9fa',
            borderBottom: '2px solid #e9ecef',
            minHeight: '50px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Box sx={{ 
              fontSize: '0.85rem', 
              fontWeight: 700,
              color: '#894991',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Total
            </Box>
          </Box>
        ),
        valueGetter: (params) => getRowTotal(params.row.id).toFixed(2),
        renderCell: (params) => (
          <Box sx={{ 
            fontWeight: 700, 
            color: '#894991', 
            textAlign: 'center', 
            width: '100%',
            fontSize: '0.875rem',
            backgroundColor: '#f8f9fa',
            borderRadius: 1,
            py: 0.5,
            border: '1px solid #e9ecef'
          }}>
            {params.value}
          </Box>
        ),
      },
      {
        field: 'action',
        headerName: 'Action',
        width: 70,
        headerAlign: 'center',
        align: 'center',
        sortable: false,
        renderHeader: () => (
          <Box sx={{ 
            textAlign: 'center',
            py: 1,
            px: 0.5,
            backgroundColor: '#f8f9fa',
            borderBottom: '2px solid #e9ecef',
            minHeight: '50px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Box sx={{ 
              fontSize: '0.8rem', 
              fontWeight: 700,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Action
            </Box>
          </Box>
        ),
        renderCell: (params) => (
          <IconButton 
            color="error" 
            size="small" 
            onClick={() => handleDeleteCategory(params.row.id)} 
            disabled={categories.length === 1}
            sx={{
              '&:hover': {
                backgroundColor: '#ffebee'
              },
              '&.Mui-disabled': {
                opacity: 0.3
              }
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      },
    ];
  }, [days, data, categoryOptions, handleCategoryChange, handleCommentChange, handleCellChange, handleDeleteCategory, getRowTotal, categories.length]);

  useEffect(() => { 
    if (tableRef) tableRef(localTableRef.current); 
  }, [tableRef]);

  return (
    <Box sx={{ 
      marginBottom: 3, 
      position: 'relative', 
      paddingBottom: 2,
      backgroundColor: '#fff',
      borderRadius: 2,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        backgroundColor: '#894991', 
        color: 'white', 
        px: 2, 
        py: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6" sx={{ 
          color: 'white', 
          fontWeight: 600,
          fontSize: '1.1rem'
        }}>
          {label}
        </Typography>
        <Chip 
          label={`Total: ${getSectionTotal().toFixed(2)}`}
          size="small"
          sx={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            fontWeight: 600
          }}
        />
      </Box>
      
      <Box
        ref={localTableRef}
        onScroll={onTableScroll}
        sx={{ 
          height: 400, 
          width: '100%', 
          overflow: 'auto',
          '&::-webkit-scrollbar': { 
            width: '8px', 
            height: '8px' 
          }, 
          '&::-webkit-scrollbar-track': { 
            background: '#f8f9fa', 
            borderRadius: '4px' 
          }, 
          '&::-webkit-scrollbar-thumb': { 
            background: '#c1c1c1', 
            borderRadius: '4px', 
            '&:hover': { 
              background: '#a8a8a8' 
            } 
          },
          '& .MuiDataGrid-root': {
            border: 'none',
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #f0f0f0',
              padding: '4px 8px'
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #e9ecef',
              '& .MuiDataGrid-columnHeader': {
                borderRight: '1px solid #e9ecef'
              }
            },
            '& .MuiDataGrid-row': {
              '&:hover': {
                backgroundColor: '#f8f9fa'
              }
            }
          }
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          hideFooter
          disableColumnMenu
          disableRowSelectionOnClick
          sx={{ 
            minWidth: `${220 + 280 + days.length * 80 + 90 + 70}px`,
            '& .MuiDataGrid-cell:focus': {
              outline: 'none'
            }
          }}
        />
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        py: 2,
        px: 2,
        borderTop: '1px solid #f0f0f0'
      }}>
        <IconButton
          color="primary"
          onClick={onAddCategory}
          sx={{ 
            background: '#f8f9fa', 
            border: '2px dashed #894991', 
            borderRadius: 2, 
            width: '220px', 
            height: 40, 
            '&:hover': { 
              background: '#e8f4f8', 
              borderColor: '#6a3d6f',
              transform: 'scale(1.02)'
            },
            transition: 'all 0.2s ease-in-out'
          }}
          size="small"
        >
          <AddIcon sx={{ color: '#894991', mr: 1 }} />
          <Typography sx={{ 
            color: '#894991', 
            fontWeight: 500,
            fontSize: '0.875rem'
          }}>
            Ajouter une catégorie
          </Typography>
        </IconButton>
      </Box>
    </Box>
  );
}
