import Colors from '@/theme/Colors';
import { RECEIVER_CONTENT_TOP_SPACING } from '@constants/index';
import ParcelCard from '@/features/receiver/incoming/components/ParcelCard';
import {
  INCOMING_FILTERS,
  type IncomingFilterKey,
  useIncomingParcels,
} from '@/features/receiver/incoming/hooks/useIncomingParcels';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IncomingScreen() {
  const router = useRouter();
  const { loading, filters, reload } = useIncomingParcels();
  const [activeFilter, setActiveFilter] = useState<IncomingFilterKey>(INCOMING_FILTERS[0].key);

  const selectedFilter = useMemo(() => {
    return filters.find((filter) => filter.key === activeFilter) ?? filters[0];
  }, [activeFilter, filters]);

  const parcels = selectedFilter?.data ?? [];
  const emptyTitle =
    selectedFilter?.key === 'ALL' ? 'Aucun colis à recevoir pour le moment' : 'Aucun colis dans cette catégorie';

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={parcels}
        keyExtractor={(parcel) => parcel.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={styles.filterBar}>
            {filters.map((filter) => {
              const isActive = filter.key === selectedFilter?.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setActiveFilter(filter.key)}
                  disabled={isActive}
                >
                  <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{filter.label}</Text>
                  <View style={[styles.chipBadge, isActive && styles.chipBadgeActive]}>
                    <Text style={[styles.chipBadgeText, isActive && styles.chipBadgeTextActive]}>
                      {filter.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        }
        renderItem={({ item: parcel }) => (
          <ParcelCard
            parcel={parcel}
            onReload={reload}
            onOpenDetails={() => {
              const href: Href = { pathname: '/parcel/[id]' as const, params: { id: parcel.id } };
              router.push(href);
            }}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>
                Lorsqu’un expéditeur vous choisit comme destinataire, le colis apparaît dans l’onglet correspondant.
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: RECEIVER_CONTENT_TOP_SPACING,
    paddingBottom: 40,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    gap: 8,
  },
  chipActive: {
    backgroundColor: Colors.cardAccent,
    borderColor: Colors.cardAccent,
  },
  chipLabel: { color: Colors.textSecondary, fontWeight: '600' },
  chipLabelActive: { color: Colors.buttonText },
  chipBadge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.background,
  },
  chipBadgeActive: { backgroundColor: Colors.white },
  chipBadgeText: { color: Colors.textSecondary, fontWeight: '700', textAlign: 'center' },
  chipBadgeTextActive: { color: Colors.buttonText },
  emptyState: { paddingTop: RECEIVER_CONTENT_TOP_SPACING, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  emptyText: { textAlign: 'center', color: Colors.textSecondary, maxWidth: 260 },
});
