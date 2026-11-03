'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, list } from '@/lib/client';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/pricing';
import type { AdvancedData } from '@/lib/advanced';

export type Supplier = { id: number; name: string; url: string; phone: string; city: string; notes: string };
export type SupplyQuote = { id: number; supply_id: number; supplier: string; price: number; qty: number; url: string; quote_date: string };

export type FullData = AdvancedData & { suppliers: Supplier[]; quotes: SupplyQuote[] };

const EMPTY: FullData = {
  settings: DEFAULT_SETTINGS, supplies: [], workers: [], equipment: [], fixed: [], products: [], recipes: [], steps: [], suppliers: [], quotes: [],
};

/** Carga todos los datos del modo avanzado y permite reemplazar una lista. */
export function useAdvanced() {
  const [data, setData] = useState<FullData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [s, supplies, workers, equipment, fixed, products, recipes, steps, suppliers, quotes] = await Promise.all([
        api<{ settings: Settings }>('/api/settings').then((x) => x.settings),
        list('supplies'), list('workers'), list('equipment'), list('fixed_costs'), list('products'),
        list('recipe_items'), list('process_steps'), list('suppliers'), list('supply_quotes'),
      ]);
      setData({ settings: s, supplies, workers, equipment, fixed, products, recipes, steps, suppliers, quotes });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setList = useCallback(
    <K extends keyof FullData>(key: K) =>
      (fn: (prev: FullData[K]) => FullData[K]) =>
        setData((d) => ({ ...d, [key]: fn(d[key]) })),
    [],
  );

  return { data, setData, setList, loading, error, reload };
}
