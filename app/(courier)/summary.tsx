import Colors from "@/constants/Colors";
import { generateClient } from "aws-amplify/data";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Schema } from "../../amplify/data/resource"; // ajuste le chemin si besoin

export default function ParcelSummary() {
  const router = useRouter();
  const client = generateClient<Schema>();
  const params = useLocalSearchParams();

  const [submitting, setSubmitting] = useState(false);

  // Normalisation + affichage propre (et compat 'adresse' legacy -> adresseDepart)
  const parsed = useMemo(() => {
    const rawType = params.type ? String(params.type) : "";
    const rawPoids = params.poids != null ? String(params.poids) : "";
    const poidsNum = rawPoids ? Number(rawPoids.replace(",", ".")) : undefined;

    const adresseDepart =
      (params.adresseDepart ? String(params.adresseDepart) : undefined) ||
      (params.adresse ? String(params.adresse) : undefined); // legacy fallback

    const adresseArrivee = params.adresseArrivee ? String(params.adresseArrivee) : undefined;

    return {
      type: rawType.trim(),
      poids: Number.isFinite(poidsNum as number) ? (poidsNum as number) : undefined,
      dimensions: params.dimensions ? String(params.dimensions) : undefined,
      description: params.description ? String(params.description) : undefined,
      adresseDepart,
      adresseArrivee,
    };
  }, [params]);

  const handleConfirm = async () => {
    // Validations minimales
    if (!parsed.type) {
      Alert.alert("Champ manquant", "Le type de colis est requis (sélectionne un preset).");
      return;
    }
    if (!parsed.adresseDepart?.trim()) {
      Alert.alert("Champ manquant", "L'adresse de départ est requise.");
      return;
    }
    if (!parsed.adresseArrivee?.trim()) {
      Alert.alert("Champ manquant", "L'adresse d'arrivée est requise.");
      return;
    }

    try {
      setSubmitting(true);
      const now = new Date().toISOString();

      await client.models.Parcel.create({
        type: parsed.type,
        status: "AVAILABLE", // requis par le backend
        poids: parsed.poids,
        dimensions: parsed.dimensions,
        description: parsed.description,
        // ✅ nouveau schéma
        adresseDepart: parsed.adresseDepart?.trim(),
        adresseArrivee: parsed.adresseArrivee?.trim(),
        createdAt: now,
        updatedAt: now,
      } as any);

      router.replace("/pending");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Échec de la création du colis.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (v?: string | number | null) => (v === undefined || v === null || v === "" ? "—" : String(v));
  const fmtKg = (v?: number | string | null) => {
    if (v === undefined || v === null || v === "") return "—";
    const n = typeof v === "string" ? Number(String(v).replace(",", ".")) : v;
    return Number.isFinite(n as number) ? `${n} kg` : String(v);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Résumé du colis</Text>

      <Row label="Type" value={fmt(parsed.type)} />
      <Row label="Poids" value={fmtKg(parsed.poids)} />
      <Row label="Dimensions" value={fmt(parsed.dimensions)} />
      <Row label="Description" value={fmt(parsed.description)} />
      {/* ✅ deux adresses */}
      <Row label="Adresse de départ" value={fmt(parsed.adresseDepart)} />
      <Row label="Adresse d’arrivée" value={fmt(parsed.adresseArrivee)} />

      <TouchableOpacity
        style={[styles.button, submitting && { opacity: 0.7 }]}
        onPress={handleConfirm}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Confirmer et enregistrer</Text>}
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 10,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 22,
    marginBottom: 8,
    textAlign: "center",
    color: Colors.text,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: "bold",
  },
});