import { useQuery } from '@tanstack/react-query';

import { api } from './api';

export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: api.products });
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: api.categories });
export const useShopSettings = () => useQuery({ queryKey: ['settings'], queryFn: api.settings });
