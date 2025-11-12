import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { listIncomingParcels } from '../services/parcels';
import type { Parcel } from '../types';

export const INCOMING_FILTERS = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'AWAITING_RECEIVER_CONFIRMATION', label: 'À confirmer', status: 'AWAITING_RECEIVER_CONFIRMATION' },
  { key: 'AWAITING_PICKUP', label: 'Confirmés (en attente de prise en charge)', status: 'AWAITING_PICKUP' },
  { key: 'IN_TRANSIT', label: 'En cours de livraison', status: 'IN_TRANSIT' },
] as const;

export type IncomingFilterKey = (typeof INCOMING_FILTERS)[number]['key'];

type IncomingFilter = {
  key: IncomingFilterKey;
  label: string;
  status?: Parcel['status'];
  data: Parcel[];
  count: number;
};

export function useIncomingParcels() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Parcel[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listIncomingParcels();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const filters: IncomingFilter[] = useMemo(() => {
    return INCOMING_FILTERS.map((filter) => {
      const data = filter.status ? items.filter((p) => p.status === filter.status) : items;
      return { ...filter, data, count: data.length };
    });
  }, [items]);

  return { loading, filters, reload };
}
