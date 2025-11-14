import ParcelCard from "@features/receiver/pending/components/ParcelCard";
import QRModal from "@features/receiver/pending/components/QRModal";
import {
  PENDING_FILTERS,
  type PendingFilterKey,
  usePendingParcels,
} from "@features/receiver/pending/hooks/usePendingParcels";
import Colors from "@/theme/Colors";
import { RECEIVER_CONTENT_TOP_SPACING } from "@constants/index";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PendingScreen() {
  const {
    filters,
    loading,
    reloadAll,
    qrVisible,
    setQrVisible,
    qrError,
    qrValue,
    qrParcel,
    insets,
    showQrForParcel,
    qrLoading,
  } = usePendingParcels();

  const [activeFilter, setActiveFilter] = useState<PendingFilterKey>(PENDING_FILTERS[0].key);

  const selectedFilter = useMemo(() => {
    return filters.find((filter) => filter.key === activeFilter) ?? filters[0];
  }, [activeFilter, filters]);

  const parcels = selectedFilter?.data ?? [];
  const emptyTitle =
    selectedFilter?.key === "ALL"
      ? "Aucun colis à préparer pour le moment"
      : "Aucun colis dans cette catégorie";

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={parcels}
        keyExtractor={(item, index) => item.parcel?.id ?? `${item.mode}-${index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reloadAll} />}
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
        renderItem={({ item }) => (
          <ParcelCard parcel={item.parcel} mode={item.mode} onShowQr={showQrForParcel} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyText}>
                Les colis disponibles ou pris en charge apparaîtront ici en fonction de leur statut.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
      />

      <QRModal
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        qrError={qrError}
        qrValue={qrValue}
        qrParcel={qrParcel}
        qrLoading={qrLoading}
        insets={insets}
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    gap: 8,
  },
  chipActive: { backgroundColor: Colors.cardAccent, borderColor: Colors.cardAccent },
  chipLabel: { color: Colors.textSecondary, fontWeight: "600" },
  chipLabelActive: { color: Colors.buttonText },
  chipBadge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.background,
  },
  chipBadgeActive: { backgroundColor: Colors.white },
  chipBadgeText: { color: Colors.textSecondary, fontWeight: "700", textAlign: "center" },
  chipBadgeTextActive: { color: Colors.buttonText },
  emptyState: { paddingTop: RECEIVER_CONTENT_TOP_SPACING, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: Colors.text },
  emptyText: { textAlign: "center", color: Colors.textSecondary, maxWidth: 260 },
});
