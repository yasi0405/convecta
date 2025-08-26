import { generateClient } from "aws-amplify/data";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Schema } from "../../amplify/data/resource";

const BPOST_PRESETS = [
  {
    id: "standard",
    label: "Bpost — Colis standard (<=30 kg)",
    help: "Longueur <= 1,5 m et L+2W+2H <= 3 m.",
    max: { kg: 30, longestCm: 150, sumCm: 300 },
  },
  {
    id: "locker",
    label: "Bpost — Locker bbox (<=30 kg)",
    help: "Casier: max 420 × 310 × 580 mm.",
    max: { kg: 30, box: [42, 31, 58] },
  },
  {
    id: "packfree",
    label: "Bpost — Pack & Label Free (<=10 kg)",
    help: "Casier: max 480 × 320 × 200 mm.",
    max: { kg: 10, box: [48, 32, 20] },
  },
] as const;

export default function NewParcel() {
  const router = useRouter();
  const client = generateClient<Schema>();
  const [type, setType] = useState("");
  const [poids, setPoids] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [adresse, setAdresse] = useState("");
  const [preset, setPreset] = useState<typeof BPOST_PRESETS[number]["id"] | null>(null);

  type Parcel = {
    id: string;
    type: string;
    poids?: number | string;
    dimensions?: string;
    description?: string;
    adresse?: string;
  };

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadParcels = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await client.models.Parcel.list({
        filter: { status: { eq: "AVAILABLE" } },
      });
      setParcels(Array.isArray(res.data) ? (res.data as any) : []);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du chargement des colis");
      setParcels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParcels();
  }, []);

  const handleSubmit = () => {
    router.push({
      pathname: "/summary",
      params: { type, poids, dimensions, description, adresse },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Colis disponibles</Text>
      {loading && (
        <View style={styles.centerRow}>
          <ActivityIndicator />
          <Text style={styles.muted}> Chargement…</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && (
        <FlatList
          data={parcels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.type || "Colis"}</Text>
              {item.description ? <Text style={styles.cardText}>{item.description}</Text> : null}
              {item.poids ? <Text style={styles.cardText}>Poids: {String(item.poids)} kg</Text> : null}
              {item.dimensions ? <Text style={styles.cardText}>Dim: {item.dimensions}</Text> : null}
              {item.adresse ? <Text style={styles.cardText}>Enlèvement: {item.adresse}</Text> : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>Aucun colis dispo pour le moment.</Text>}
        />
      )}
      <View style={{ marginBottom: 24 }}>
        <Button title="Rafraîchir la liste" onPress={loadParcels} />
      </View>
      <Text style={styles.title}>Type bpost (pré-enregistré)</Text>
      <View style={{ marginBottom: 12 }}>
        {BPOST_PRESETS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              setPreset(p.id);
              setType(p.label);
            }}
            style={[styles.preset, preset === p.id && styles.presetActive]}
          >
            <Text style={styles.presetLabel}>{p.label}</Text>
            <Text style={styles.presetHelp}>{p.help}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.title}>Nouveau colis</Text>
      <TextInput style={styles.input} placeholder="Type de colis" value={type} onChangeText={setType} editable={false} />
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
  centerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  muted: { color: "#666", marginLeft: 8 },
  error: { color: "#B00020", marginBottom: 12 },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: "#fafafa" },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cardText: { fontSize: 14 },
  preset: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: "#fff" },
  presetActive: { borderColor: "#1e88e5", backgroundColor: "#e3f2fd" },
  presetLabel: { fontWeight: "600", marginBottom: 4 },
  presetHelp: { color: "#555", fontSize: 12 },
});