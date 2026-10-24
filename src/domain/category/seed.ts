import type { Category } from './category';

export const SEED_CATEGORIES: readonly Category[] = [
  { id: 'food', name: 'Food', color: '#2A78D6', tint: '#D9E8FA' },
  { id: 'rent', name: 'Rent & Bills', color: '#EB6834', tint: '#FBE2D6' },
  { id: 'transport', name: 'Transport', color: '#1BAF7A', tint: '#D6F1E6' },
  { id: 'family', name: 'Family', color: '#EDA100', tint: '#FBEBC4' },
  { id: 'friends', name: 'Friends', color: '#2A78D6', tint: '#D9E8FA' },
  { id: 'airtime', name: 'Airtime & Data', color: '#E87BA4', tint: '#FADCE8' },
  { id: 'shopping', name: 'Shopping', color: '#E87BA4', tint: '#FADCE8' },
  { id: 'health', name: 'Health', color: '#9A9A9A', tint: '#EDEDED' },
  { id: 'education', name: 'Education', color: '#6250D6', tint: '#E6E1FA' },
  { id: 'income', name: 'Income', color: '#1F7A4D', tint: '#D6F1E6' },
  { id: 'electronics', name: 'Electronics', color: '#3A8FB7', tint: '#D9EEF6' },
  { id: 'entertainment', name: 'Entertainment & Subscriptions', color: '#B455D6', tint: '#F0DDF8' },
  { id: 'personalcare', name: 'Personal Care', color: '#D64F6E', tint: '#FADADF' },
  { id: 'giving', name: 'Giving', color: '#7A8F1F', tint: '#EAF0CC' },
  { id: 'savings', name: 'Savings & Investing', color: '#0F8B8D', tint: '#D2EEEE' },
  { id: 'services', name: 'Services', color: '#7A6A58', tint: '#ECE6DF' },
  { id: 'other', name: 'Other', color: '#9A9A9A', tint: '#EDEDED' },
];

export const CATEGORY_SWATCHES = [
  '#6250D6',
  '#2A78D6',
  '#EB6834',
  '#1BAF7A',
  '#EDA100',
  '#E87BA4',
] as const;
