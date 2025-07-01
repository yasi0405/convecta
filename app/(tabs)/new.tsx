import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput } from "react-native";

export default function NewParcel() {
  const router = useRouter();
  const [type, setType] = useState("");
  const [poids, setPoids] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [adresse, setAdresse] = useState("");

  const handleSubmit = () => {
    router.push({
      pathname: "/summary",
      params: { type, poids, dimensions, description, adresse },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nouveau colis</Text>
      <TextInput style={styles.input} placeholder="Type de colis" value={type} onChangeText={setType} />
      <TextInput style={styles.input} placeholder="Poids (kg)" value={poids} onChangeText={setPoids} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Dimensions (cm)" value={dimensions} onChangeText={setDimensions} />
      <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} />
      <TextInput style={styles.input} placeholder="Adresse d’enlèvement" value={adresse} onChangeText={setAdresse} />
      <Button title="Valider" onPress={handleSubmit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center" },
  input: {
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
});