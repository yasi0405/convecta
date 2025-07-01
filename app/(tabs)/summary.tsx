import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { useParcelContext } from "../../src/context/ParcelContext";

export default function ParcelSummary() {
  const router = useRouter();
  const { addParcel } = useParcelContext();
  const { type, poids, dimensions, description, adresse } = useLocalSearchParams();

  const handleConfirm = () => {
    addParcel({
      type: String(type),
      poids: String(poids),
      dimensions: String(dimensions),
      description: String(description),
      adresse: String(adresse),
    });
    router.replace("/pending");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Résumé du colis</Text>
      <Text>Type : {type}</Text>
      <Text>Poids : {poids} kg</Text>
      <Text>Dimensions : {dimensions}</Text>
      <Text>Description : {description}</Text>
      <Text>Adresse d’enlèvement : {adresse}</Text>
      <View style={styles.button}>
        <Button title="Confirmer" onPress={handleConfirm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center" },
  button: { marginTop: 30 },
});