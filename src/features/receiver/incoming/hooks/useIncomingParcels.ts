import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { listIncomingParcels } from '../services/parcels';
import type { Parcel } from '../types';

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

  const sections = useMemo(() => {
    const awaitingConfirm = items.filter((p) => p.status === 'AWAITING_RECEIVER_CONFIRMATION');
    const awaitingPickup = items.filter((p) => p.status === 'AWAITING_PICKUP');
    const inTransit = items.filter((p) => p.status === 'IN_TRANSIT');
    const delivered = items.filter((p) => p.status === 'DELIVERED');
    return [
      { key: 'AWAITING_RECEIVER_CONFIRMATION', title: 'À confirmer', data: awaitingConfirm },
      { key: 'AWAITING_PICKUP', title: 'Confirmés (en attente de prise en charge)', data: awaitingPickup },
      { key: 'IN_TRANSIT', title: 'En cours de livraison', data: inTransit },
      { key: 'DELIVERED', title: 'Livrés', data: delivered },
    ].filter((s) => s.data.length > 0);
  }, [items]);

  return { loading, sections, reload };
}