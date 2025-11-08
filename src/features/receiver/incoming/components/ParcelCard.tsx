import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Parcel } from '../types';
import ConfirmWindowModal from './ConfirmWindowModal';
import StatusPill from './StatusPill';

export default function ParcelCard({
  parcel,
  onOpenDetails,
  onReload,
}: {
  parcel: Parcel;
  onOpenDetails: () => void;
  onReload: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const showConfirm = parcel.status === 'AWAITING_RECEIVER_CONFIRMATION';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>{parcel.code ?? parcel.id}</Text>
        <StatusPill status={parcel.status} />
      </View>

      <View style={{ marginTop: 8, gap: 4 }}>
        <Text>🧍‍♀️ {parcel.senderName}</Text>
        {parcel.pickupAddressLabel && <Text>📦 {parcel.pickupAddressLabel}</Text>}
        {parcel.dropoffAddressLabel && <Text>🏠 {parcel.dropoffAddressLabel}</Text>}
        {parcel.etaText ? <Text>⏱️ {parcel.etaText}</Text> : null}
        {parcel.proposedWindow ? (
          <Text>🗓️ {fmtRange(parcel.proposedWindow.startISO, parcel.proposedWindow.endISO)}</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onOpenDetails} style={[styles.btn, styles.btnGhost]}>
          <Text>Détails</Text>
        </TouchableOpacity>
        {showConfirm && (
          <TouchableOpacity onPress={() => setConfirmOpen(true)} style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnLabel}>Confirmer</Text>
          </TouchableOpacity>
        )}
      </View>

      {showConfirm && (
        <ConfirmWindowModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          parcelId={parcel.id}
          defaultStartISO={parcel.proposedWindow?.startISO}
          defaultEndISO={parcel.proposedWindow?.endISO}
          onConfirmed={async () => {
            setConfirmOpen(false);
            await onReload();
          }}
        />
      )}
    </View>
  );
}

function fmtRange(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return '—';
  const s = new Date(startISO);
  const e = new Date(endISO);
  return `${s.toLocaleString()} → ${e.toLocaleTimeString()}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    elevation: 2,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#0a84ff' },
  btnLabel: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d0d5dd' },
});