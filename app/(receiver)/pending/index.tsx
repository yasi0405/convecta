import ParcelCard from "@features/receiver/pending/components/ParcelCard";
import QRModal from "@features/receiver/pending/components/QRModal";
import { usePendingParcels } from "@features/receiver/pending/hooks/usePendingParcels";
import { styles } from "@features/receiver/pending/styles";
import Colors from "@/theme/Colors";
import React, { useCallback } from "react";
import { RefreshControl, SafeAreaView, ScrollView, Text, View } from "react-native";

export default function PendingScreen() {
  const {
    myPendingParcels,
    takenParcels,
    loadMyPendingParcels,
    loadTakenParcels,
    loadingMyPending,
    loadingTaken,
    qrVisible,
    setQrVisible,
    qrError,
    qrValue,
    qrParcel,
    insets,
    showQrForParcel,
    qrLoading,
  } = usePendingParcels();

  const refreshing = loadingMyPending || loadingTaken;
  const refreshAll = useCallback(() => {
    loadMyPendingParcels();
    loadTakenParcels();
  }, [loadMyPendingParcels, loadTakenParcels]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={Colors.accent} />
        }
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>Colis en attente</Text>
            <Text style={styles.sectionMeta}>{myPendingParcels.length} colis</Text>
          </View>
          {myPendingParcels.length === 0 ? (
            <Text style={styles.cardText}>
              {loadingMyPending ? "Chargement..." : "Aucun colis en attente."}
            </Text>
          ) : (
            <View style={styles.cardList}>
              {myPendingParcels.map((parcel) => (
                <ParcelCard key={(parcel as any)?.id} parcel={parcel} mode="pending" />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>Colis pris en charge</Text>
            <Text style={styles.sectionMeta}>{takenParcels.length} colis</Text>
          </View>
          {takenParcels.length === 0 ? (
            <Text style={styles.cardText}>
              {loadingTaken ? "Chargement..." : "Aucun colis pris en charge pour le moment."}
            </Text>
          ) : (
            <View style={styles.cardList}>
              {takenParcels.map((parcel) => (
                <ParcelCard
                  key={(parcel as any)?.id}
                  parcel={parcel}
                  mode="taken"
                  onShowQr={showQrForParcel}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

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
