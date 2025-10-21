import Colors from "@/constants/Colors";
import { Parcel, useParcelContext } from "@/src/context/ParcelContext";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// ✅ Amplify (user + data)
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";

// ⚙️ Typage souple si ton ParcelContext n’a pas encore ces champs
type ParcelWithAssign = Parcel & {
  status?: "AVAILABLE" | "ASSIGNED" | "IN_PROGRESS" | "DELIVERING" | "DELIVERED" | "CANCELLED";
  assignedTo?: string | null;
  courierName?: string | null; // si tu l’enregistres lors de l’acceptation
};

const client = generateClient<any>();

export default function ParcelList() {
  const { pendingParcels } = useParcelContext();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [takenParcels, setTakenParcels] = useState<ParcelWithAssign[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔐 Récupère l’utilisateur connecté
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        // Selon ta version Amplify, ça peut être user.userId / user.username / user.signInDetails?.loginId
        const uid = (user as any)?.userId ?? (user as any)?.username ?? (user as any)?.signInDetails?.loginId ?? null;
        setCurrentUserId(uid);
      } catch (e) {
        console.log("getCurrentUser error:", e);
      }
    })();
  }, []);

  // 🔎 Charge les colis "pris en charge" pour CE client (owner = client)
  const loadTakenParcels = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const res = await client.models.Parcel.list({
        // @ts-ignore : filtre DataStore/Gen2 (Amplify v6). Adapte si tu es en GraphQL v5.
        filter: {
          owner: { eq: currentUserId },
          or: [
            { status: { eq: "ASSIGNED" } },
            { status: { eq: "IN_PROGRESS" } },
            { status: { eq: "DELIVERING" } },
          ],
        },
        limit: 100,
      });

      // Compatibilité selon les versions : res.data ? res.data : res.items
      const items: ParcelWithAssign[] =
        (res?.data as ParcelWithAssign[]) ??
        ((res as any)?.items as ParcelWithAssign[]) ??
        [];

      setTakenParcels(items);
    } catch (e) {
      console.log("loadTakenParcels error:", e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadTakenParcels();
  }, [loadTakenParcels]);

  const renderTaken = ({ item }: { item: ParcelWithAssign }) => {
    const who =
      item.courierName?.trim() ||
      (item.assignedTo ? `Livreur #${item.assignedTo.slice(0, 6)}…` : "—");
    const _status = String(item.status);
    const statutLisible =
      _status === "ASSIGNED" ? "Assigné"
      : _status === "IN_PROGRESS" ? "En cours"
      : _status === "DELIVERING" ? "En livraison"
      : item.status ?? "—";

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📦 {item.type ?? "Colis"}</Text>
        {item.description ? (
          <Text style={styles.cardText}>Description : {item.description}</Text>
        ) : null}

        {item.adresseDepart ? (
          <Text style={styles.cardText}>Départ : {item.adresseDepart}</Text>
        ) : null}
        {item.adresseArrivee ? (
          <Text style={styles.cardText}>Arrivée : {item.adresseArrivee}</Text>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.badge}>Statut : {statutLisible}</Text>
          <Text style={styles.badge}>Pris en charge par : {who}</Text>
        </View>

        {/* Si tu stockes un ETA/temps/commission côté serveur, affiche-les ici */}
        {Boolean((item as any).tempsCourse) && (
          <Text style={styles.muted}>⏱️ Temps estimé : {(item as any).tempsCourse}</Text>
        )}
      </View>
    );
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
            keyExtractor={(_, index) => `pending-${index}`}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📦 {item.type}</Text>
                {item.poids ? (
                  <Text style={styles.cardText}>Poids : {item.poids} kg</Text>
                ) : null}
                {item.dimensions ? (
                  <Text style={styles.cardText}>Dimensions : {item.dimensions}</Text>
                ) : null}
                {item.description ? (
                  <Text style={styles.cardText}>Description : {item.description}</Text>
                ) : null}
                {item.adresseDepart ? (
                  <Text style={styles.cardText}>Départ : {item.adresseDepart}</Text>
                ) : null}
                {item.adresseArrivee ? (
                  <Text style={styles.cardText}>Arrivée : {item.adresseArrivee}</Text>
                ) : null}
              </View>
            )}
          />

          <TouchableOpacity style={styles.button} onPress={() => console.log("refresh pending")}>
            <Text style={styles.buttonText}>Rafraîchir la liste</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 🔥 Section : Colis de ce client déjà pris en charge */}
      <Text style={[styles.title, { marginTop: 28 }]}>Colis pris en charge</Text>
      {takenParcels.length === 0 ? (
        <Text style={styles.cardText}>
          {loading ? "Chargement..." : "Aucun colis pris en charge pour le moment."}
        </Text>
      ) : (
        <>
          <FlatList
            data={takenParcels}
            keyExtractor={(item, index) => (item as any)?.id ?? `taken-${index}`}
            renderItem={renderTaken}
          />
          <TouchableOpacity style={styles.button} onPress={loadTakenParcels}>
            <Text style={styles.buttonText}>{loading ? "Chargement…" : "Rafraîchir les colis pris en charge"}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  title: { fontSize: 22, marginBottom: 14, textAlign: "center", color: Colors.text },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    backgroundColor: Colors.card,
  },
  cardTitle: { color: Colors.textOnCard, fontWeight: "600", marginBottom: 6 },
  cardText: { color: Colors.textOnCard, marginBottom: 4 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 },
  badge: {
    color: Colors.textOnCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  muted: { color: Colors.textOnCard, opacity: 0.7, marginTop: 6 },
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },
});