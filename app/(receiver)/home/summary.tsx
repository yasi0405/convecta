import Colors from "@/theme/Colors";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import type { Schema } from "@amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RECEIVER_CONTENT_TOP_SPACING } from "@constants/index";

ensureAmplifyConfigured();

// —— Services (isolés) ——
function getClient() {
  // Lazy init du client pour éviter les warnings "Amplify has not been configured"
  return generateClient<Schema>();
}

async function loadParcelById(id: string) {
  const client = getClient();
  // @ts-ignore
  const res = await client.models.Parcel.get({ id } as any, { authMode: "userPool" });
  return (res as any)?.data as Parcel | null;
}

async function createParcelFromData(data: Parcel) {
  const client = getClient();
  const now = new Date().toISOString();
  // @ts-ignore
  await client.models.Parcel.create(
    {
      type: data.type,
      status: "AVAILABLE",
      poids: (data.poids as number | undefined) ?? undefined,
      dimensions: data.dimensions || undefined,
      adresseDepart: data.adresseDepart?.trim(),
      adresseArrivee: data.adresseArrivee?.trim(),
      createdAt: now,
      updatedAt: now,
    } as any,
    { authMode: "userPool" }
  );
}

type Parcel = {
  id?: string;
  type?: string;
  status?: "AVAILABLE" | "ASSIGNED" | "DELIVERED";
  poids?: number | string | null;
  dimensions?: string | null;
  adresseDepart?: string | null;   // ✅ nouveau
  adresseArrivee?: string | null;  // ✅ nouveau
  createdAt?: string | null;
  updatedAt?: string | null;
};

export default function ParcelSummary() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [submitting, setSubmitting] = useState(false);
  const [loadingById, setLoadingById] = useState(false);
  const [fromDb, setFromDb] = useState<Parcel | null>(null);

  // --- MODE B : si on reçoit un id, on charge depuis la DB
  useEffect(() => {
    const id = params.id ? String(params.id) : "";
    if (!id) return;

    (async () => {
      try {
        setLoadingById(true);
        const row = await loadParcelById(id);
        setFromDb(row ?? null);
      } catch (e: any) {
        Alert.alert("Erreur", e?.message ?? "Impossible de charger le colis.");
      } finally {
        setLoadingById(false);
      }
    })();
  }, [params.id]);

  // --- MODE A : normalise les params passés via router.push({ params })
  const fromParams = useMemo<Parcel>(() => {
    const rawType = params.type ? String(params.type) : "";
    const rawPoids = params.poids != null ? String(params.poids) : "";
    const poidsNum = rawPoids ? Number(rawPoids.replace(",", ".")) : undefined;

    return {
      type: rawType.trim() || undefined,
      poids: Number.isFinite(poidsNum as number) ? (poidsNum as number) : undefined,
      dimensions: params.dimensions ? String(params.dimensions) : undefined,
      adresseDepart: params.adresseDepart ? String(params.adresseDepart) : undefined, // ✅
      adresseArrivee: params.adresseArrivee ? String(params.adresseArrivee) : undefined, // ✅
    };
  }, [params]);

  // --- Source finale : DB > Params
  const data: Parcel = fromDb ?? fromParams;

  const handleConfirm = async () => {
    // Si on est en MODE B (depuis DB), pas besoin de créer
    if (fromDb?.id) {
      Alert.alert("Info", "Ce colis est déjà enregistré.");
      return;
    }
    if (!data.type) {
      Alert.alert("Champ manquant", "Le type de colis est requis (sélectionne un preset).");
      return;
    }
    if (!data.adresseDepart?.trim()) {
      Alert.alert("Champ manquant", "L'adresse de départ est requise.");
      return;
    }
    if (!data.adresseArrivee?.trim()) {
      Alert.alert("Champ manquant", "L'adresse d'arrivée est requise.");
      return;
    }

    try {
      setSubmitting(true);
      await createParcelFromData(data);
      router.replace("/(receiver)/pending");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Échec de la création du colis.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (v?: string | number | null) => (v == null || v === "" ? "—" : String(v));
  const fmtKg = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? `${n} kg` : String(v);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Résumé du colis</Text>

        {loadingById ? (
          <View style={styles.centerRow}>
            <ActivityIndicator />
            <Text style={styles.muted}> Chargement…</Text>
          </View>
        ) : null}

        <Row label="Type" value={fmt(data.type)} />
        <Row label="Poids" value={fmtKg(data.poids)} />
        <Row label="Dimensions" value={fmt(data.dimensions)} />
        {/* ✅ 2 lignes adresses */}
        <Row label="Adresse de départ" value={fmt(data.adresseDepart)} />
        <Row label="Adresse d’arrivée" value={fmt(data.adresseArrivee)} />

        <TouchableOpacity
          style={[styles.button, (submitting || !!fromDb?.id) && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.buttonText}>
              {fromDb?.id ? "Déjà en base" : "Confirmer et enregistrer"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Bloc debug (désactive en prod) */}
        {__DEV__ && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.label, { marginBottom: 4 }]}>[DEV] Params reçus :</Text>
            <Text style={[styles.value, { fontSize: 12 }]}>{JSON.stringify(params)}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: RECEIVER_CONTENT_TOP_SPACING,
    backgroundColor: Colors.background,
    flexGrow: 1,
    gap: 10,
  },
  title: { fontSize: 22, marginBottom: 8, textAlign: "center", color: Colors.text },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  value: { fontSize: 16, color: Colors.text },
  button: { backgroundColor: Colors.button, paddingVertical: 14, borderRadius: 8, marginTop: 24, alignItems: "center" },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  muted: { color: Colors.textSecondary, marginLeft: 8 },
});
