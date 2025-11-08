import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ParcelCard from '@/features/receiver/incoming/components/ParcelCard';
import { useIncomingParcels } from '@/features/receiver/incoming/hooks/useIncomingParcels';

export default function IncomingScreen() {
  const router = useRouter();
  const { loading, sections, reload } = useIncomingParcels();

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
        ListEmptyComponent={
          !loading ? (
            <View style={{ paddingTop: 48, alignItems: 'center' }}>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyText: { opacity: 0.7, textAlign: 'center' },
});