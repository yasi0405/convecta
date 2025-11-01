import type { Href } from 'expo-router';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Incoming (À recevoir) — liste des colis que l'utilisateur va recevoir.
 *
 * ⚠️ Intégration backend:
 *  - Remplacer les fonctions mock (listIncomingParcels, confirmReceptionWindow)
 *    par vos appels réels (ex: Amplify API.graphql / REST).
 *  - Les types ci-dessous sont volontairement simples; alignez-les avec votre schéma.
 */

type ParcelStatus =
  | 'AWAITING_RECEIVER_CONFIRMATION'
  | 'AWAITING_PICKUP'
  | 'IN_TRANSIT'
  | 'DELIVERED';

export type Parcel = {
  id: string;
  code?: string; // identifiant lisible si besoin
  senderName: string;
  pickupAddressLabel?: string;
  dropoffAddressLabel?: string;
  etaText?: string; // ex: "~35 min"
  status: ParcelStatus;
  proposedWindow?: { startISO: string; endISO: string } | null;
  createdAtISO: string;
};

// ---------------- MOCK API (à remplacer) ---------------- //
async function listIncomingParcels(): Promise<Parcel[]> {
  // TODO: remplacer par API réelle
  await new Promise((r) => setTimeout(r, 250));
  const now = new Date();
  const start = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'PX-001',
      code: 'CV-7F3A',
      senderName: 'Client A (Martine D.)',
      pickupAddressLabel: 'Ixelles — Place Flagey',
      dropoffAddressLabel: 'Bruxelles — Rue du Midi',
      etaText: undefined,
      status: 'AWAITING_RECEIVER_CONFIRMATION',
      proposedWindow: { startISO: start, endISO: end },
      createdAtISO: new Date().toISOString(),
    },
    {
      id: 'PX-002',
      code: 'CV-92B1',
      senderName: 'Client A (Boulangerie P.)',
      pickupAddressLabel: 'Uccle — Churchill',
      dropoffAddressLabel: 'Saint-Gilles — Parvis',
      etaText: '~1 h',
      status: 'AWAITING_PICKUP',
      proposedWindow: { startISO: start, endISO: end },
      createdAtISO: new Date().toISOString(),
    },
    {
      id: 'PX-003',
      code: 'CV-55Q9',
      senderName: 'Client A (Atelier K.)',
      pickupAddressLabel: 'Etterbeek',
      dropoffAddressLabel: 'Forest',
      etaText: '~20 min',
      status: 'IN_TRANSIT',
      proposedWindow: null,
      createdAtISO: new Date().toISOString(),
    },
  ];
}

async function confirmReceptionWindow(
  parcelId: string,
  startISO: string,
  endISO: string
): Promise<{ ok: true }> {
  // TODO: remplacer par API réelle (mutation)
  await new Promise((r) => setTimeout(r, 400));
  console.log('CONFIRM WINDOW', { parcelId, startISO, endISO });
  return { ok: true };
}
// ------------------------------------------------------- //

export default function IncomingScreen() {
  const router = useRouter();
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
    const awaitingConfirm = items.filter(
      (p) => p.status === 'AWAITING_RECEIVER_CONFIRMATION'
    );
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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 16 }}
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        renderItem={({ item: section }) => (
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((p) => (
              <ParcelCard
                key={p.id}
                parcel={p}
                onOpenDetails={() => {
                  const href: Href = { pathname: '/parcel/[id]' as const, params: { id: p.id } };
                  router.push(href);
                }}
                onReload={reload}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <Text style={styles.emptyTitle}>Aucun colis à recevoir</Text>
            <Text style={styles.emptyText}>
              Lorsqu’un expéditeur vous choisit comme destinataire, le colis apparaît ici.
            </Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

function ParcelCard({ parcel, onOpenDetails, onReload }: { parcel: Parcel; onOpenDetails: () => void; onReload: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const showConfirm = parcel.status === 'AWAITING_RECEIVER_CONFIRMATION';

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.cardTitle}>{parcel.code ?? parcel.id}</Text>
        <StatusPill status={parcel.status} />
      </View>

      <View style={{ marginTop: 8, gap: 4 }}>
        <Text style={styles.rowText}>🧍‍♀️ Émetteur · {parcel.senderName}</Text>
        {parcel.pickupAddressLabel ? (
          <Text style={styles.rowText}>📦 Enlèvement · {parcel.pickupAddressLabel}</Text>
        ) : null}
        {parcel.dropoffAddressLabel ? (
          <Text style={styles.rowText}>🏠 Livraison · {parcel.dropoffAddressLabel}</Text>
        ) : null}
        {parcel.etaText ? <Text style={styles.rowText}>⏱️ Estimation · {parcel.etaText}</Text> : null}
        {parcel.proposedWindow ? (
          <Text style={styles.rowText}>
            🗓️ Créneau proposé · {fmtRange(parcel.proposedWindow.startISO, parcel.proposedWindow.endISO)}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onOpenDetails} style={[styles.btn, styles.btnGhost]}>
          <Text style={[styles.btnLabel, styles.btnGhostLabel]}>Détails</Text>
        </TouchableOpacity>
        {showConfirm ? (
          <TouchableOpacity onPress={() => setConfirmOpen(true)} style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnLabel}>Confirmer</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showConfirm ? (
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
      ) : null}
    </View>
  );
}

function StatusPill({ status }: { status: ParcelStatus }) {
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

function fmtRange(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return '—';
  const s = new Date(startISO);
  const e = new Date(endISO);
  return `${s.toLocaleString()} → ${e.toLocaleTimeString()}`;
}

function ConfirmWindowModal({
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyText: {
    opacity: 0.7,
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  rowText: { fontSize: 13, opacity: 0.9 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#0a84ff' },
  btnLabel: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d0d5dd' },
  btnGhostLabel: { color: '#111' },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
  },
  pillText: { color: '#1D4ED8', fontWeight: '600', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubtitle: { marginTop: 4, opacity: 0.8 },
  presetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  presetBtnLabel: { fontWeight: '600' },
  inputLabel: { marginTop: 10, marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    fontFamily: 'System',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
});
