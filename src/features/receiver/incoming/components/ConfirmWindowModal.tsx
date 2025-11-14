import Colors from "@/theme/Colors";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(-1);
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);

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

  useEffect(() => {
    if (!presets.length) return;
    const matching = presets.findIndex((p) => p.s === defaultStartISO && p.e === defaultEndISO);
    const fallbackIndex = matching >= 0 ? matching : 0;
    setSelectedPresetIdx(fallbackIndex);
    setStartISO(presets[fallbackIndex].s);
    setEndISO(presets[fallbackIndex].e);
  }, [presets, defaultStartISO, defaultEndISO]);

  useEffect(() => {
    if (!open) setSlotPickerOpen(false);
  }, [open]);

  const handlePresetSelect = useCallback(
    (index: number) => {
      const preset = presets[index];
      if (!preset) return;
      setSelectedPresetIdx(index);
      setStartISO(preset.s);
      setEndISO(preset.e);
      setSlotPickerOpen(false);
    },
    [presets]
  );

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
            {presets.map((p, idx) => (
              <TouchableOpacity
                key={p.label}
                onPress={() => handlePresetSelect(idx)}
                style={[
                  styles.presetBtn,
                  selectedPresetIdx === idx ? styles.presetBtnActive : styles.presetBtnInactive,
                ]}
              >
                <Text
                  style={[
                    styles.presetBtnLabel,
                    selectedPresetIdx === idx ? styles.presetBtnLabelActive : styles.presetBtnLabelInactive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.dropdownBlock}>
            <Text style={styles.dropdownLabel}>Sélection de créneau</Text>
            <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setSlotPickerOpen((prev) => !prev)}>
              <Text style={styles.dropdownValue}>
                {selectedPresetIdx >= 0 ? presets[selectedPresetIdx]?.label : 'Choisir un créneau'}
              </Text>
              <Text style={styles.dropdownChevron}>{slotPickerOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {slotPickerOpen && (
              <View style={styles.dropdownList}>
                {presets.map((p, idx) => (
                  <TouchableOpacity
                    key={`${p.label}-dropdown`}
                    onPress={() => handlePresetSelect(idx)}
                    style={[
                      styles.dropdownOption,
                      selectedPresetIdx === idx && styles.dropdownOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionLabel,
                        selectedPresetIdx === idx && styles.dropdownOptionLabelActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

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
  presetBtn: { paddingVertical: 12, borderRadius: 12, paddingHorizontal: 14 },
  presetBtnActive: { backgroundColor: Colors.button, borderWidth: 1, borderColor: Colors.button },
  presetBtnInactive: {
    backgroundColor: 'rgba(68, 222, 172, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(68, 222, 172, 0.4)',
  },
  presetBtnLabel: { fontWeight: '700', textAlign: 'center' },
  presetBtnLabelActive: { color: Colors.buttonText },
  presetBtnLabelInactive: { color: Colors.buttonText },
  dropdownBlock: { marginTop: 18 },
  dropdownLabel: { fontWeight: '600', marginBottom: 8 },
  dropdownTrigger: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: { fontWeight: '600', color: '#111' },
  dropdownChevron: { color: '#111', fontSize: 12 },
  dropdownList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  dropdownOption: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownOptionActive: { backgroundColor: 'rgba(68, 222, 172, 0.15)' },
  dropdownOptionLabel: { color: '#111', fontWeight: '600' },
  dropdownOptionLabelActive: { color: Colors.buttonText },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#0a84ff' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d0d5dd' },
  btnLabel: { color: '#fff', fontWeight: '700' },
  btnGhostLabel: { color: '#111' },
});
