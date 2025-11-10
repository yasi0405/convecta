import Colors from '@/theme/Colors';
import ParcelCard from '@/features/receiver/incoming/components/ParcelCard';
import { useIncomingParcels } from '@/features/receiver/incoming/hooks/useIncomingParcels';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IncomingScreen() {
  const router = useRouter();
  const { loading, sections, reload } = useIncomingParcels();

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        renderItem={({ item: section }) => (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionMeta}>{section.data.length} colis</Text>
            </View>
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
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Aucun colis à recevoir</Text>
              <Text style={styles.emptyText}>
                Lorsqu’un expéditeur vous choisit comme destinataire, le colis apparaît ici.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionMeta: { color: Colors.textSecondary, fontSize: 13 },
  emptyState: { paddingTop: 64, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyText: { textAlign: 'center', color: Colors.textSecondary, maxWidth: 260 },
});
