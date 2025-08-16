import { Database } from '~/types/database.types';

export const T_SHIRT_SIZE_OPTIONS = [
  { value: 'YXXS' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Youth XXS' },
  { value: 'YXS' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Youth XS' },
  { value: 'YS' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Youth S' },
  { value: 'YM' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Youth M' },
  { value: 'YL' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Youth L' },
  { value: 'YXL' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Youth XL' },
  { value: 'AS' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Adult S' },
  { value: 'AM' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Adult M' },
  { value: 'AL' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Adult L' },
  { value: 'AXL' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Adult XL' },
  { value: 'A2XL' as Database['public']['Enums']['t_shirt_size_enum'], label: 'Adult 2XL' },
] as const;

export const T_SHIRT_SIZE_VALUES = T_SHIRT_SIZE_OPTIONS.map(option => option.value);