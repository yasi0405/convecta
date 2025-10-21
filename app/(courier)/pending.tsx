import Colors from "@/constants/Colors";
import { Parcel as ParcelCtx, useParcelContext } from "@/src/context/ParcelContext";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type ParcelStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DELIVERING"
  | "DELIVERED"
  | "CANCELLED";

type Parcel = Omit<ParcelCtx, "status"> & {
  status?: ParcelStatus;
  assignedTo?: string | null;
  courierName?: string | null;
  owner?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const client = generateClient<any>();

export default function CourierPendingList() {
  const { pendingParcels } = useParcelContext();

  const [userId, setUserId] = useState<string | null>(null);
  const [myParcels, setMyParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [onlyInProgress, setOnlyInProgress] = useState<boolean>(true); // ✅ filtre dynamique

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

  // 🔎 Charge les colis assignés à CE livreur
  const loadMyParcels = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await client.models.Parcel.list(
        {
          filter: {
            assignedTo: { eq: userId },
            ...(onlyInProgress
              ? { status: { eq: "IN_PROGRESS" } }
              : {
                  or: [
                    { status: { eq: "ASSIGNED" } },
                    { status: { eq: "IN_PROGRESS" } },
                    { status: { eq: "DELIVERING" } },
                  ],
                }),
          },
          limit: 200,
        },
        { authMode: "userPool" }
      );

      const listResult = res;
      const items: Parcel[] =
        (Array.isArray(listResult?.data) && listResult.data.length > 0
          ? listResult.data
          : Array.isArray((listResult as any)?.items)
          ? (listResult as any).items
          : []) as Parcel[];

      const order: Record<string, number> = {
        IN_PROGRESS: 0,
        DELIVERING: 1,
        ASSIGNED: 2,
      };

      items.sort((a, b) => {
        const pa = order[a.status ?? "ASSIGNED"] ?? 9;
        const pb = order[b.status ?? "ASSIGNED"] ?? 9;
        if (pa !== pb) return pa - pb;

        const ca = a.createdAt ? Date.parse(a.createdAt) : 0;
        const cb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return ca - cb;
      });

      setMyParcels(items);
    } catch (e) {
      console.log("loadMyParcels error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, onlyInProgress]);

  useEffect(() => {
    loadMyParcels();
  }, [loadMyParcels]);

  const fmt = (v?: string | number | null) =>
    v == null || v === "" ? "—" : String(v);
  const fmtKg = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n = typeof v === "string" ? Number(String(v).replace(",", ".")) : v;
    return Number.isFinite(n as number) ? `${n} kg` : String(v);
  };
  const readableStatus = (s?: Parcel["status"]) =>
    s === "IN_PROGRESS" ? "En cours"
      : s === "DELIVERING" ? "En livraison"
      : s === "ASSIGNED" ? "Assigné"
      : s ?? "—";

  const currentParcelId = useMemo(() => myParcels[0]?.id ?? null, [myParcels]);

  const startMission = async (p: Parcel) => {
    if (!p?.id || !userId) return;
    setActingId(String(p.id));
    try {
      await client.models.Parcel.update(
        {
          id: p.id,
          status: "IN_PROGRESS",
          assignedTo: p.assignedTo ?? userId,
          updatedAt: new Date().toISOString(),
        },
        { authMode: "userPool" }
      );
      await loadMyParcels();
    } catch (e) {
      console.log("startMission error:", e);
    } finally {
      setActingId(null);
    }
  };

  const setDelivering = async (p: Parcel) => {
    if (!p?.id || !userId) return;
    setActingId(String(p.id));
    try {
      await client.models.Parcel.update(
        {
          id: p.id,
          status: "DELIVERING",
          assignedTo: p.assignedTo ?? userId,
          updatedAt: new Date().toISOString(),
        },
        { authMode: "userPool" }
      );
      await loadMyParcels();
    } catch (e) {
      console.log("setDelivering error:", e);
    } finally {
      setActingId(null);
    }
  };

  const markDelivered = async (p: Parcel) => {
    if (!p?.id || !userId) return;
    setActingId(String(p.id));
    try {
      await client.models.Parcel.update(
        {
          id: p.id,
          status: "DELIVERED",
          assignedTo: p.assignedTo ?? userId,
          updatedAt: new Date().toISOString(),
        },
        { authMode: "userPool" }
      );
      await loadMyParcels();
    } catch (e) {
      console.log("markDelivered error:", e);
    } finally {
      setActingId(null);
    }
  };

  const renderItem = ({ item, index }: { item: Parcel; index: number }) => {
    const isCurrent = currentParcelId === item.id;
    const isActing = actingId === String(item.id);

    return (
      <View style={[styles.card, isCurrent && styles.currentCard]}>
        <View style={styles.headerRow}>
          <Text style={[styles.cardText, styles.cardTitle]}>
            {isCurrent ? "🚀 Mission en cours" : "📦 Mission"}
          </Text>
          <Text style={[styles.badge, isCurrent && styles.badgePrimary]}>
            {readableStatus(item.status)}
          </Text>
        </View>

        <Text style={styles.cardText}>Type : {fmt(item.type)}</Text>
        <Text style={styles.cardText}>Poids : {fmtKg(item.poids)}</Text>
        {item.dimensions ? (
          <Text style={styles.cardText}>Dimensions : {fmt(item.dimensions)}</Text>
        ) : null}
        {item.description ? (
          <Text style={styles.cardText}>Description : {fmt(item.description)}</Text>
        ) : null}
        <Text style={styles.cardText}>Départ : {fmt(item.adresseDepart)}</Text>
        <Text style={styles.cardText}>Arrivée : {fmt(item.adresseArrivee)}</Text>

        <View style={styles.actionsRow}>
          {item.status === "ASSIGNED" && index === 0 && (
            <TouchableOpacity
              style={[styles.button, styles.primary]}
              onPress={() => startMission(item)}
              disabled={isActing}
            >
              {isActing ? <ActivityIndicator /> : <Text style={styles.buttonText}>Démarrer</Text>}
            </TouchableOpacity>
          )}

          {(item.status === "IN_PROGRESS" || item.status === "DELIVERING") && (
            <>
              {item.status === "IN_PROGRESS" && (
                <TouchableOpacity
                  style={[styles.button, styles.secondary]}
                  onPress={() => setDelivering(item)}
                  disabled={isActing}
                >
                  {isActing ? <ActivityIndicator /> : <Text style={styles.buttonText}>En livraison</Text>}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.primary]}
                onPress={() => markDelivered(item)}
                disabled={isActing}
              >
                {isActing ? <ActivityIndicator /> : <Text style={styles.buttonText}>Marquer livré</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mes missions</Text>

      {/* ✅ Toggle filtre */}
      <TouchableOpacity
        style={[styles.refreshButton, { marginBottom: 10, backgroundColor: onlyInProgress ? "#4CAF50" : Colors.button }]}
        onPress={() => setOnlyInProgress(v => !v)}
      >
        <Text style={styles.refreshText}>
          {onlyInProgress ? "Voir tous (assignés + en livraison)" : "Voir uniquement En cours"}
        </Text>
      </TouchableOpacity>

      {loading && myParcels.length === 0 ? (
        <ActivityIndicator />
      ) : myParcels.length === 0 ? (
        <Text style={styles.cardText}>
          Aucun colis {onlyInProgress ? "en cours" : "assigné"} pour le moment.
        </Text>
      ) : (
        <>
          <FlatList
            data={myParcels}
            keyExtractor={(item, index) =>
              (item as any)?.id ? String((item as any).id) : String(index)
            }
            renderItem={renderItem}
          />

          <TouchableOpacity style={styles.refreshButton} onPress={loadMyParcels}>
            <Text style={styles.refreshText}>{loading ? "Chargement…" : "Rafraîchir"}</Text>
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
  currentCard: { borderColor: Colors.button, borderWidth: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontWeight: "600" },
  cardText: { color: Colors.textOnCard, marginBottom: 4 },
  badge: {
    color: Colors.textOnCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgePrimary: { borderColor: Colors.button },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: Colors.button },
  secondary: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  buttonText: { color: Colors.buttonText, fontWeight: "600" },
  refreshButton: {
    backgroundColor: Colors.button,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 6,
    alignItems: "center",
  },
  refreshText: { color: Colors.buttonText, fontWeight: "bold" },
});