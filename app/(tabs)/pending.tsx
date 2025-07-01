import { Parcel, useParcelContext } from "@/src/context/ParcelContext";
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";


export default function ParcelList() {
  const { pendingParcels } = useParcelContext();
    console.log("Colis en attente :", pendingParcels);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Colis en attente</Text>
      {pendingParcels.length === 0 ? (
        <Text>Aucun colis pour le moment.</Text>
      ) : (
        <FlatList<Parcel>
          data={pendingParcels}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text>📦 {item.type}</Text>
              <Text>Poids : {item.poids} kg</Text>
              <Text>Dimensions : {item.dimensions}</Text>
              <Text>Description : {item.description}</Text>
              <Text>Adresse : {item.adresse}</Text>
            </View>

          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center" },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    padding: 15,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
  },
});
