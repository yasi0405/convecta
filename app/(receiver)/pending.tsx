import Colors from "@/constants/Colors";
import { Parcel, useParcelContext } from "@/src/context/ParcelContext";
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ParcelList() {
  const { pendingParcels } = useParcelContext();
  console.log("Colis en attente :", pendingParcels);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Colis en attente</Text>

      {pendingParcels.length === 0 ? (
        <Text style={styles.cardText}>Aucun colis pour le moment.</Text>
      ) : (
        <>
          <FlatList<Parcel>
            data={pendingParcels}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardText}>📦 {item.type}</Text>
                {item.poids ? (
                  <Text style={styles.cardText}>Poids : {item.poids} kg</Text>
                ) : null}
                {item.dimensions ? (
                  <Text style={styles.cardText}>Dimensions : {item.dimensions}</Text>
                ) : null}
                {item.description ? (
                  <Text style={styles.cardText}>Description : {item.description}</Text>
                ) : null}

                {/* ✅ Nouvelles adresses */}
                {item.adresseDepart ? (
                  <Text style={styles.cardText}>Départ : {item.adresseDepart}</Text>
                ) : null}
                {item.adresseArrivee ? (
                  <Text style={styles.cardText}>Arrivée : {item.adresseArrivee}</Text>
                ) : null}
              </View>
            )}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={() => console.log("refresh")}
          >
            <Text style={styles.buttonText}>Rafraîchir la liste</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center", color: Colors.text },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 5,
    padding: 15,
    marginBottom: 10,
    backgroundColor: Colors.card,
  },
  cardText: {
    color: Colors.textOnCard,
    marginBottom: 4,
  },
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: "bold",
  },
});