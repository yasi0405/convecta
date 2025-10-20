import Colors from "@/constants/Colors";
import { generateClient } from "aws-amplify/data";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Schema } from "../../amplify/data/resource";

export default function CourierHome() {
  const client = generateClient<Schema>();
  const router = useRouter();

  type Parcel = {
    id: string;
    type: string;
    status: "AVAILABLE" | "ASSIGNED" | "DELIVERED";
    poids?: number | string | null;
    dimensions?: string | null;
    description?: string | null;
    adresse?: string | null;
    createdAt?: string | null; // ISO 8601
    updatedAt?: string | null;
  };

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [accepting, setAccepting] = useState<boolean>(false);

  const listAvailable = async () => {
    // 1) tente en userPool (JWT)
    try {
      const res = await client.models.Parcel.list({
        filter: { status: { eq: "AVAILABLE" } },
        authMode: "userPool"
      });
      return (Array.isArray(res.data) ? (res.data as any) : []) as Parcel[];
    } catch (e: any) {
      // 2) fallback en mode défaut (identityPool) si tu réactives la lecture guest plus tard
      const msg = e?.message ?? "";
      if (!/Unauthorized/i.test(msg)) throw e;
      const res = await client.models.Parcel.list({ filter: { status: { eq: "AVAILABLE" } } });
      return (Array.isArray(res.data) ? (res.data as any) : []) as Parcel[];
    }
  };

  const loadParcels = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await listAvailable();
      setParcels(rows);
    } catch (e: any) {
      console.log("list Parcel error →", e);
      setError(e?.message ?? "Erreur lors du chargement des colis");
      setParcels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParcels();
  }, []);

  const sortedParcels = useMemo(() => {
    return [...parcels].sort((a, b) => {
      const da = a.createdAt ? Date.parse(a.createdAt) : 0;
      const db = b.createdAt ? Date.parse(b.createdAt) : 0;
      return db - da;
    });
  }, [parcels]);

  const onSelect = (p: Parcel) => {
    setSelected(p);
  };

  const onAccept = async () => {
    if (!selected) return;
    try {
      setAccepting(true);
      const now = new Date().toISOString();

      // Mutation: passer le colis en ASSIGNED
      await client.models.Parcel.update(
        {
          id: selected.id,
          status: "ASSIGNED",
          updatedAt: now,
        } as any,
        { authMode: "userPool" }
      );

      // Retirer localement
      setParcels((prev) => prev.filter((x) => x.id !== selected.id));

      // 👇 Redirection vers la page de navigation Mapbox avec l’adresse
      router.push({
        pathname: "/(courier)/navigate",
        params: {
          id: selected.id,
          dest: selected.adresse ?? "",
          label: selected.type ?? "Mission",
        },
      });

      setSelected(null);
    } catch (e: any) {
      console.log("accept Parcel error →", e);
      setError(e?.message ?? "Erreur lors de l’acceptation de la mission");
    } finally {
      setAccepting(false);
      // Optionnel : rechargement si tu veux resynchroniser
      // loadParcels();
    }
  };

  const onCancel = () => setSelected(null);

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 80 }]}>
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
          data={sortedParcels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onSelect(item)}>
              <Text style={styles.cardTitle}>{item.type || "Colis"}</Text>
              {item.description ? <Text style={styles.cardText}>{item.description}</Text> : null}
              {item.poids != null && item.poids !== "" ? (
                <Text style={styles.cardText}>Poids: {String(item.poids)} kg</Text>
              ) : null}
              {item.dimensions ? <Text style={styles.cardText}>Dim: {item.dimensions}</Text> : null}
              {item.adresse ? <Text style={styles.cardText}>Enlèvement: {item.adresse}</Text> : null}
              {item.createdAt ? (
                <Text style={[styles.cardText, { opacity: 0.6 }]}>
                  Créé le {new Date(item.createdAt).toLocaleString()}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.muted}>Aucun colis dispo pour le moment.</Text>}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={loadParcels}>
        <Text style={styles.buttonText}>Rafraîchir la liste</Text>
      </TouchableOpacity>

      {/* Bouton debug */}
      {__DEV__ && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#444" }]}
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);
              const now = new Date().toISOString();
              await client.models.Parcel.create(
                {
                  type: "BPOST_SMALL_BOX",
                  status: "AVAILABLE",
                  poids: 1.2,
                  dimensions: "30x20x15 cm",
                  description: "Colis de test (debug)",
                  adresse: "Rue du Débogage 42, 7060 Soignies",
                  createdAt: now,
                  updatedAt: now,
                } as any,
                { authMode: "userPool" }
              );
              await loadParcels();
            } catch (e: any) {
              console.log("create Parcel (debug) error →", e);
              setError(e?.message ?? "Erreur lors de la création du colis de test");
            } finally {
              setLoading(false);
            }
          }}
        >
          <Text style={styles.buttonText}>[DEV] Créer un colis de test</Text>
        </TouchableOpacity>
      )}

      {/* Dialog Accepter mission */}
      <Modal
        transparent
        visible={!!selected}
        animationType="fade"
        onRequestClose={onCancel}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Accepter la mission ?</Text>
            {selected ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.modalText}>
                  {selected.type || "Colis"}{selected.poids ? ` · ${String(selected.poids)} kg` : ""}
                </Text>
                {selected.adresse ? <Text style={[styles.modalText, { opacity: 0.8 }]}>Enlèvement: {selected.adresse}</Text> : null}
              </View>
            ) : null}

            <View style={styles.modalRow}>
              <TouchableOpacity
                onPress={onCancel}
                disabled={accepting}
                style={[styles.modalBtn, styles.modalBtnNo]}
              >
                <Text style={styles.modalBtnText}>NO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onAccept}
                disabled={accepting}
                style={[styles.modalBtn, styles.modalBtnYes, accepting && { opacity: 0.7 }]}
              >
                {accepting ? <ActivityIndicator /> : <Text style={[styles.modalBtnText, { color: "#fff" }]}>YES</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: Colors.background, flexGrow: 1 },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center", color: Colors.text },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, justifyContent: "center" },
  muted: { color: Colors.textSecondary, textAlign: "center" },
  error: { color: "#B00020", marginBottom: 12, textAlign: "center" },

  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.card,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4, color: Colors.textOnCard },
  cardText: { fontSize: 14, color: Colors.textOnCard },

  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 24,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: Colors.textOnCard },
  modalText: { fontSize: 14, color: Colors.textOnCard, marginBottom: 4 },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  modalBtnNo: { borderColor: Colors.border, backgroundColor: Colors.background },
  modalBtnYes: { borderColor: Colors.button, backgroundColor: Colors.button },
  modalBtnText: { fontSize: 16, fontWeight: "700", color: Colors.text },
});