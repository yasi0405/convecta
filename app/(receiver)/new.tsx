import Colors from "@/constants/Colors";
import { generateClient } from "aws-amplify/data";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 80 }]}>
    
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
      <TouchableOpacity style={styles.button} onPress={loadParcels}>
        <Text style={styles.buttonText}>Rafraîchir la liste</Text>
      </TouchableOpacity>
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
      <TextInput style={styles.input} placeholder="Type de colis" value={type} onChangeText={setType} editable={false} placeholderTextColor={Colors.textSecondary} />
      <TextInput style={styles.input} placeholder="Poids (kg)" value={poids} onChangeText={setPoids} keyboardType="numeric" placeholderTextColor={Colors.textSecondary} />
      <TextInput style={styles.input} placeholder="Dimensions (cm)" value={dimensions} onChangeText={setDimensions} placeholderTextColor={Colors.textSecondary} />
      <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} placeholderTextColor={Colors.textSecondary} />
      <TextInput style={styles.input} placeholder="Adresse d’enlèvement" value={adresse} onChangeText={setAdresse} placeholderTextColor={Colors.textSecondary} />
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Valider</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: Colors.background, flexGrow: 1 },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center", color: Colors.text },
  input: {
    backgroundColor: Colors.input,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    color: Colors.text,
  },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  muted: { color: Colors.textSecondary, marginLeft: 8 },
  error: { color: "#B00020", marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.card,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4, color: Colors.textOnCard },
  cardText: { fontSize: 14, color: Colors.textOnCard },
  preset: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: "#fff" },
  presetActive: { borderColor: "#1e88e5", backgroundColor: "#e3f2fd" },
  presetLabel: { fontWeight: "600", marginBottom: 4 },
  presetHelp: { color: "#555", fontSize: 12 },
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: "bold",
  },
});