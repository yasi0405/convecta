import Colors from "@/constants/Colors";
import { Parcel, useParcelContext } from "@/src/context/ParcelContext";
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ParcelList() {
  const { pendingParcels } = useParcelContext();
  console.log("Colis en attente :", pendingParcels);

  const fmt = (v?: string | number | null) =>
    v == null || v === "" ? "—" : String(v);

  const fmtKg = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n = typeof v === "string" ? Number((v as string).replace(",", ".")) : v;
    return Number.isFinite(n as number) ? `${n} kg` : String(v);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Colis en attente</Text>

      {pendingParcels.length === 0 ? (
        <Text style={styles.cardText}>Aucun colis pour le moment.</Text>
      ) : (
        <>
          <FlatList<Parcel>
            data={pendingParcels}
            keyExtractor={(item, index) => (item.id ? String(item.id) : String(index))}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={[styles.cardText, styles.cardTitle]}>📦 {fmt(item.type)}</Text>

                {/* Meta */}
                <Text style={styles.cardText}>Poids : {fmtKg(item.poids)}</Text>
                <Text style={styles.cardText}>Dimensions : {fmt(item.dimensions)}</Text>
                {item.description ? (
                  <Text style={styles.cardText}>Description : {item.description}</Text>
                ) : null}

                {/* ✅ Nouvelles adresses */}
                <Text style={styles.cardText}>Départ : {fmt(item.adresseDepart)}</Text>
                <Text style={styles.cardText}>Arrivée : {fmt(item.adresseArrivee)}</Text>
              </View>
            )}
          />

          <TouchableOpacity style={styles.button} onPress={() => console.log("refresh")}>
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
  cardTitle: { fontWeight: "600", marginBottom: 6 },
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