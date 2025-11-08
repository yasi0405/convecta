import React, { useCallback, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { confirmReceptionWindow } from '../services/parcels';

export default function ConfirmWindowModal({
  open,
  onClose,
  parcelId,
  defaultStartISO,
  defaultEndISO,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  parcelId: string;
  defaultStartISO?: string;
  defaultEndISO?: string;
  onConfirmed: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [startISO, setStartISO] = useState<string>(defaultStartISO ?? new Date().toISOString());
  const [endISO, setEndISO] = useState<string>(
    defaultEndISO ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  );

  const presets = useMemo(() => {
    const now = new Date();
    const today17 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
    const today19 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);
    const tmr18 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0, 0);
    const tmr20 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0, 0);
    return [
      { label: "Aujourd'hui 17–19h", s: today17.toISOString(), e: today19.toISOString() },
      { label: 'Demain 18–20h', s: tmr18.toISOString(), e: tmr20.toISOString() },
    ];
  }, []);

  const submit = useCallback(async () => {
    try {
      setSubmitting(true);
      await confirmReceptionWindow(parcelId, startISO, endISO);
      await onConfirmed();
    } finally {
      setSubmitting(false);
      onClose();
    }
  }, [parcelId, startISO, endISO, onConfirmed, onClose]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Confirmer la réception</Text>
          <Text style={styles.modalSubtitle}>Choisissez un créneau de présence</Text>

          <View style={{ gap: 8, marginTop: 12 }}>
            {presets.map((p) => (
              <TouchableOpacity
                key={p.label}
                onPress={() => {
                  setStartISO(p.s);
                  setEndISO(p.e);
                }}
                style={styles.presetBtn}
              >
                <Text style={styles.presetBtnLabel}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 12 }} />
          <Text style={styles.inputLabel}>Début (ISO 8601)</Text>
          <TextInput value={startISO} onChangeText={setStartISO} style={styles.input} autoCapitalize="none" />
          <Text style={styles.inputLabel}>Fin (ISO 8601)</Text>
          <TextInput value={endISO} onChangeText={setEndISO} style={styles.input} autoCapitalize="none" />

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnGhost]} disabled={submitting}>
              <Text style={[styles.btnLabel, styles.btnGhostLabel]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[styles.btn, styles.btnPrimary]} disabled={submitting}>
              <Text style={styles.btnLabel}>{submitting ? 'Envoi…' : 'Confirmer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubtitle: { marginTop: 4, opacity: 0.8 },
  presetBtn: { paddingVertical: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginVertical: 5, paddingHorizontal: 12 },
  presetBtnLabel: { fontWeight: '600' },
  inputLabel: { marginTop: 10, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#0a84ff' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d0d5dd' },
  btnLabel: { color: '#fff', fontWeight: '700' },
  btnGhostLabel: { color: '#111' },
});