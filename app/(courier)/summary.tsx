import Colors from "@/theme/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { Schema } from "../../amplify/data/resource"; // ajuste si besoin

type Parcel = Schema["Parcel"]["type"];

export default function CourierSummary() {
  const client = generateClient<Schema>();
  const [userId, setUserId] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Récupère le livreur connecté
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const uid =
          (user as any)?.userId ??
          (user as any)?.username ??
          (user as any)?.signInDetails?.loginId ??
          null;
        setUserId(uid);
      } catch (e) {
        console.log("getCurrentUser error:", e);
      }
    })();
  }, []);

  // Charge toutes les courses livrées
  useEffect(() => {
    if (!userId) return;

    const loadDelivered = async () => {
      setLoading(true);
      try {
        const res = await client.models.Parcel.list({
          filter: {
            assignedTo: { eq: userId },
            status: { eq: "DELIVERED" },
          },
          limit: 100,
          authMode: "userPool", 
        });

        const items =
          (res?.data as Parcel[]) ||
          (Array.isArray((res as any)?.items) ? (res as any).items : []);
        // tri par date décroissante
        items.sort((a, b) =>
          (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? "")
        );
        setDelivered(items);
      } catch (e) {
        console.log("loadDelivered error:", e);
      } finally {
        setLoading(false);
      }
    };

    loadDelivered();
  }, [userId]);

  const fmt = (v?: string | number | null) =>
    v == null || v === "" ? "—" : String(v);

  const fmtKg = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n =
      typeof v === "string" ? Number(String(v).replace(",", ".")) : v;
    return Number.isFinite(n as number) ? `${n} kg` : String(v);
  };

  const renderItem = ({ item }: { item: Parcel }) => (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <IconSymbol name="cube.box.fill" size={18} color={Colors.accent} />
        <Text style={styles.cardTitle}>{fmt(item.type)}</Text>
      </View>
      <Text style={styles.cardText}>Poids : {fmtKg(item.poids)}</Text>
      <Text style={styles.cardText}>
        Dimensions : {fmt(item.dimensions)}
      </Text>
      <Text style={styles.cardText}>
        Départ : {fmt(item.adresseDepart)}
      </Text>
      <Text style={styles.cardText}>
        Arrivée : {fmt(item.adresseArrivee)}
      </Text>
      <Text style={styles.dateText}>
        Livré le :{" "}
        {item.deliveredAt
          ? new Date(item.deliveredAt).toLocaleString("fr-FR")
          : "—"}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Courses terminées</Text>

      {loading ? (
        <ActivityIndicator />
      ) : delivered.length === 0 ? (
        <Text style={styles.emptyText}>
          Aucune course livrée pour le moment.
        </Text>
      ) : (
        <FlatList
          data={delivered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  title: {
    fontSize: 22,
    marginBottom: 16,
    textAlign: "center",
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  cardTitle: { fontWeight: "600", fontSize: 16, color: Colors.text },
  cardText: { color: Colors.textOnCard, marginBottom: 3 },
  dateText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.textSecondary,
    marginTop: 30,
  },
});
