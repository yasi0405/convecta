import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ParcelStatus } from '../types.js';

export default function StatusPill({ status }: { status: ParcelStatus }) {
  const label =
    status === 'AWAITING_RECEIVER_CONFIRMATION'
      ? 'À confirmer'
      : status === 'AWAITING_PICKUP'
      ? 'En attente de prise en charge'
      : status === 'IN_TRANSIT'
      ? 'En cours'
      : 'Livré';

  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
  },
  pillText: { color: '#1D4ED8', fontWeight: '600', fontSize: 12 },
});