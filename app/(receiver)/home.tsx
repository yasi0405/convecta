import Colors from "@/constants/Colors";
import { getCurrentUser } from "aws-amplify/auth"; // ✅ check auth
import { generateClient } from "aws-amplify/data";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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

// ✅ Alerte cross-platform (Alert est capricieux sur web)
const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}\n\n${msg}`) : Alert.alert(title, msg);

export default function NewParcel() {
  const router = useRouter();
  const client = generateClient<Schema>();

  const [type, setType] = useState("");
  const [poids, setPoids] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [adresse, setAdresse] = useState("");
  const [preset, setPreset] = useState<typeof BPOST_PRESETS[number]["id"] | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // ✅ Garde-fous UI
    if (!preset) {
      setError("Choisis d’abord un preset bpost.");
      return;
    }
    if (!type) {
      setError("Sélectionne d'abord un type (preset bpost).");
      return;
    }

    // normalise poids : "1,5" -> "1.5"
    const poidsNormalized = poids?.trim().replace(",", ".");
    const poidsNum = poidsNormalized ? parseFloat(poidsNormalized) : undefined;

    try {
      setLoading(true);
      setError(null);

      // ✅ Vérifie si utilisateur connecté
      let user = null;
      try {
        user = await getCurrentUser();
        console.log("✅ Utilisateur connecté :", user);
      } catch (err) {
        console.log("❌ Aucun utilisateur connecté :", err);
        user = null;
      }

      if (!user) {
        notify("Non connecté", "Tu dois être connecté pour créer un colis. Connecte-toi avant de continuer.");
        return;
      }

      const now = new Date().toISOString();

      // ✅ Création du colis (aligné backend: identityPool, pas de defaults côté schéma)
      const res = await client.models.Parcel.create({
        type,
        poids: Number.isFinite(poidsNum as number) ? (poidsNum as number) : undefined,
        dimensions: dimensions?.trim() || undefined,
        description: description?.trim() || undefined,
        adresse: adresse?.trim() || undefined,
        status: "AVAILABLE",
        createdAt: now,
        updatedAt: now,
      } as any,
      { authMode: 'userPool' }

    );

      const createdId = (res as any)?.data?.id ?? "";

      // reset formulaire
      setType("");
      setPoids("");
      setDimensions("");
      setDescription("");
      setAdresse("");
      setPreset(null);

      // navigation vers le résumé (DB mode par id)
      router.replace({
        pathname: "/(receiver)/summary",
        params: { id: createdId },
      });
    } catch (e: any) {
      console.log("create Parcel error →", e);
      setError(e?.message ?? "Erreur lors de la création du colis");
      // Optionnel : afficher aussi une alerte
      // notify("Erreur", e?.message ?? "Erreur lors de la création du colis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 80 }]}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

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
      <TextInput
        style={styles.input}
        placeholder="Type de colis"
        value={type}
        onChangeText={setType}
        editable={false}
        placeholderTextColor={Colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Poids (kg)"
        value={poids}
        onChangeText={setPoids}
        keyboardType="numeric"
        placeholderTextColor={Colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Dimensions (cm)"
        value={dimensions}
        onChangeText={setDimensions}
        placeholderTextColor={Colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        placeholderTextColor={Colors.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Adresse d’enlèvement"
        value={adresse}
        onChangeText={setAdresse}
        placeholderTextColor={Colors.textSecondary}
      />

      <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Création…" : "Valider"}</Text>
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
  error: { color: "#B00020", marginBottom: 12, textAlign: "center" },
  preset: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: "#fff" },
  presetActive: { borderColor: "#1e88e5", backgroundColor: "#e3f2fd" },
  presetLabel: { fontWeight: "600", marginBottom: 4, color: Colors.textOnCard },
  presetHelp: { color: "#555", fontSize: 12 },
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },
});