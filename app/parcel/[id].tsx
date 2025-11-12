import { IconSymbol } from '@/components/ui/IconSymbol';
import StatusPill from '@/features/receiver/incoming/components/StatusPill';
import { getIncomingParcel } from '@/features/receiver/incoming/services/parcels';
import type { Parcel } from '@/features/receiver/incoming/types';
import Colors from '@/theme/Colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ParcelDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const parcelId = useMemo(() => {
    const value = params.id;
    if (Array.isArray(value)) return value[0];
    return value;
  }, [params.id]);

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parcelId) {
      setError('Identifiant de colis manquant.');
      return;
    }
    setLoading(true);
    setError(null);
    getIncomingParcel(parcelId)
      .then((data) => {
        setParcel(data);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Impossible de charger ce colis.');
      })
      .finally(() => setLoading(false));
  }, [parcelId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={18} color={Colors.text} />
          <Text style={styles.backLabel}>Retour</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.stateText}>Chargement du colis…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => router.replace('/')}>
              <Text style={styles.btnPrimaryLabel}>Retour à l’accueil</Text>
            </TouchableOpacity>
          </View>
        ) : parcel ? (
          <View style={styles.card}>
            <View style={styles.header}>
              <View>
                <Text style={styles.parcelCode}>{parcel.code ?? parcel.id}</Text>
                <Text style={styles.meta}>Envoyé par {parcel.senderName}</Text>
              </View>
              <StatusPill status={parcel.status} />
            </View>

            <View style={styles.section}>
              <SectionTitle>Itinéraire</SectionTitle>
              <InfoRow icon="mappin.and.ellipse" label="Collecte" value={parcel.pickupAddressLabel} />
              <InfoRow icon="house.fill" label="Livraison" value={parcel.dropoffAddressLabel} />
            </View>

            <View style={styles.section}>
              <SectionTitle>Infos pratiques</SectionTitle>
              <InfoRow icon="timer" label="Estimation" value={parcel.etaText ?? '—'} />
              <InfoRow icon="calendar" label="Créneau proposé" value={fmtWindow(parcel.proposedWindow)} />
              <InfoRow icon="clock.arrow.circlepath" label="Créé le" value={fmtDate(parcel.createdAtISO)} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <IconSymbol name={icon} size={18} color={Colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function fmtWindow(window?: Parcel['proposedWindow'] | null) {
  if (!window?.startISO || !window?.endISO) return '—';
  const start = new Date(window.startISO);
  const end = new Date(window.endISO);
  return `${start.toLocaleString()} → ${end.toLocaleTimeString()}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 16, flexGrow: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backLabel: { color: Colors.text, fontWeight: '600' },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  parcelCode: { fontSize: 20, fontWeight: '700', color: Colors.text },
  meta: { color: Colors.textSecondary, marginTop: 4 },
  section: { gap: 12 },
  sectionTitle: { color: Colors.textOnCard, fontWeight: '700', fontSize: 15 },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.input,
  },
  infoLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  infoValue: { color: Colors.text, fontWeight: '600' },
  stateCard: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stateText: { color: Colors.text, textAlign: 'center' },
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999 },
  btnPrimary: { backgroundColor: Colors.button },
  btnPrimaryLabel: { color: Colors.buttonText, fontWeight: '700' },
});
