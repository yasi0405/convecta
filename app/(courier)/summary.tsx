import Colors from "@/constants/Colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
      <Text style={{ color: Colors.text }}>Type : {type}</Text>
      <Text style={{ color: Colors.text }}>Poids : {poids} kg</Text>
      <Text style={{ color: Colors.text }}>Dimensions : {dimensions}</Text>
      <Text style={{ color: Colors.text }}>Description : {description}</Text>
      <Text style={{ color: Colors.text }}>Adresse d’enlèvement : {adresse}</Text>
      <TouchableOpacity style={styles.button} onPress={handleConfirm}>
        <Text style={styles.buttonText}>Confirmer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 22,
    marginBottom: 20,
    textAlign: "center",
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 30,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: "bold",
  },
});