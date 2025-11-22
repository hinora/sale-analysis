import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';

/**
 * Props for CompanyAutocomplete component
 */
interface CompanyAutocompleteProps {
  /**
   * Selected company name
   */
  value: string;
  /**
   * Callback when company selection changes
   */
  onChange: (company: string) => void;
  /**
   * Label for the autocomplete field (default: "Công ty")
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

/**
 * Company data from API
 */
interface CompanyOption {
  _id: string;
  name: string;
  address: string;
}

/**
 * CompanyAutocomplete Component
 * 
 * Provides autocomplete search for company names.
 * Fetches company list from API and filters based on user input.
 * Supports partial matching and displays company name + address.
 * 
 * @example
 * ```tsx
 * const [company, setCompany] = useState('');
 * 
 * <CompanyAutocomplete
 *   value={company}
 *   onChange={setCompany}
 * />
 * ```
 */
export function CompanyAutocomplete({
  value,
  onChange,
  label = 'Công ty',
  placeholder = 'Tìm kiếm công ty...',
  disabled = false,
}: CompanyAutocompleteProps) {
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Fetch companies when input changes
  useEffect(() => {
    if (inputValue.length < 2) {
      setOptions([]);
      return;
    }

    const fetchCompanies = async () => {
      setLoading(true);
      try {
        // Fetch distinct companies from transactions
        const response = await fetch(`/api/companies/search?q=${encodeURIComponent(inputValue)}`);
        if (response.ok) {
          const data = await response.json();
          setOptions(data.companies || []);
        }
      } catch (error) {
        console.error('[CompanyAutocomplete] Error fetching companies:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchCompanies, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  return (
    <Autocomplete
      freeSolo
      value={value}
      onChange={(_, newValue) => {
        if (typeof newValue === 'string') {
          onChange(newValue);
        } else if (newValue) {
          onChange(newValue.name);
        } else {
          onChange('');
        }
      }}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue);
        if (!newInputValue) {
          onChange('');
        }
      }}
      options={options}
      getOptionLabel={(option) => {
        if (typeof option === 'string') return option;
        return option.name;
      }}
      loading={loading}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          size="small"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
