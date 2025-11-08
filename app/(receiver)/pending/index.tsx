import ParcelCard from "@features/receiver/pending/components/ParcelCard";
import QRModal from "@features/receiver/pending/components/QRModal";
import { usePendingParcels } from "@features/receiver/pending/hooks/usePendingParcels";
import { styles } from "@features/receiver/pending/styles";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

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
  } = usePendingParcels();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Colis en attente</Text>
      {myPendingParcels.length === 0 ? (
        <Text style={styles.cardText}>
          {loadingMyPending ? "Chargement..." : "Aucun colis en attente."}
        </Text>
      ) : (
        <>
          <FlatList
            data={myPendingParcels}
            keyExtractor={(item, index) => (item as any)?.id ?? `pending-${index}`}
            renderItem={({ item }) => <ParcelCard parcel={item} mode="pending" />}
          />
          <TouchableOpacity style={styles.button} onPress={loadMyPendingParcels}>
            <Text style={styles.buttonText}>
              {loadingMyPending ? "Chargement…" : "Rafraîchir les colis en attente"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={[styles.title, { marginTop: 28 }]}>Colis pris en charge</Text>
      {takenParcels.length === 0 ? (
        <Text style={styles.cardText}>
          {loadingTaken ? "Chargement..." : "Aucun colis pris en charge pour le moment."}
        </Text>
      ) : (
        <>
          <FlatList
            data={takenParcels}
            keyExtractor={(item, index) => (item as any)?.id ?? `taken-${index}`}
            renderItem={({ item }) => <ParcelCard parcel={item} mode="taken" />}
          />
          <TouchableOpacity style={styles.button} onPress={loadTakenParcels}>
            <Text style={styles.buttonText}>
              {loadingTaken ? "Chargement…" : "Rafraîchir les colis pris en charge"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <QRModal
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        qrError={qrError}
        qrValue={qrValue}
        qrParcel={qrParcel}
        insets={insets}
      />
    </View>
  );
}