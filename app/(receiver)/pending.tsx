import Colors from "@/constants/Colors";
import { Parcel, useParcelContext } from "@/src/context/ParcelContext";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ✅ Amplify (user + data)
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";

// 🔳 QR Code
// npx expo install react-native-qrcode-svg
import QRCode from "react-native-qrcode-svg";

// ⚙️ Typage souple si ton ParcelContext n’a pas encore ces champs
type ParcelWithAssign = Parcel & {
  id?: string;
  status?:
    | "AVAILABLE"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "DELIVERING"
    | "DELIVERED"
    | "CANCELLED";
  assignedTo?: string | null;
  courierName?: string | null; // si tu l’enregistres lors de l’acceptation
  adresseDepart?: string | null;
  adresseArrivee?: string | null;
  type?: string | null;
  description?: string | null;
  poids?: number | string | null;
  dimensions?: string | null;
};

const client = generateClient<any>();

export default function ParcelList() {
  const { pendingParcels } = useParcelContext();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [takenParcels, setTakenParcels] = useState<ParcelWithAssign[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state pour le QR plein écran
  const [qrVisible, setQrVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [qrParcel, setQrParcel] = useState<ParcelWithAssign | null>(null);
  const [qrBusyForId, setQrBusyForId] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // 🔐 Récupère l’utilisateur connecté
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        // Selon ta version Amplify, ça peut être user.userId / user.username / user.signInDetails?.loginId
        const uid =
          (user as any)?.userId ??
          (user as any)?.username ??
          (user as any)?.signInDetails?.loginId ??
          null;
        setCurrentUserId(uid);
      } catch (e) {
        console.log("getCurrentUser error:", e);
      }
    })();
  }, []);

  // 🔎 Charge les colis de CE client (owner = client) déjà pris en charge (utile pour QR)
  const loadTakenParcels = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const res = await client.models.Parcel.list({
        // Amplify v6 — params + authMode dans un seul objet
        filter: {
          owner: { eq: currentUserId },
          or: [
            { status: { eq: "ASSIGNED" } },
            { status: { eq: "IN_PROGRESS" } },
            { status: { eq: "DELIVERING" } },
            // on peut inclure DELIVERED si tu veux afficher aussi livrés
          ],
        },
        limit: 100,
        authMode: "userPool",
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

  // ▶️ Génère un code signé infalsifiable pour finaliser la réception (purpose = DELIVERY)
  const handleShowDeliveryQR = async (p: ParcelWithAssign) => {
    if (!p?.id) return;
    setQrError(null);
    setQrBusyForId(String(p.id));
    try {
      // Appelle ta mutation backend qui signe le code côté serveur
      // Retour attendu: { code, purpose, exp, kid } (cf. ton resource.ts)
      const resp = await (client as any).mutations.generateScanCode({
        parcelId: String(p.id),
        purpose: "DELIVERY",
        authMode: "userPool",
      });

      // Selon ton resolver, adapte la façon de lire la réponse
      const payload =
        resp?.data?.generateScanCode ??
        resp?.data ??
        resp;

      const code = payload?.code ?? payload?.data?.code ?? null;

      if (!code) {
        setQrError("Impossible de générer le QR. Réessaie.");
        setQrBusyForId(null);
        return;
      }

      setQrParcel(p);
      setQrValue(String(code));
      setQrVisible(true);
    } catch (e: any) {
      console.log("generateScanCode error:", e);
      setQrError(e?.message ?? "Erreur lors de la génération du QR.");
    } finally {
      setQrBusyForId(null);
    }
  };

  const fmt = (v?: string | number | null) =>
    v == null || v === "" ? "—" : String(v);
  const fmtKg = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n =
      typeof v === "string" ? Number(String(v).replace(",", ".")) : v;
    return Number.isFinite(n as number) ? `${n} kg` : String(v);
  };
  const statusFR = (s?: ParcelWithAssign["status"]) =>
    s === "ASSIGNED"
      ? "Assigné"
      : s === "IN_PROGRESS"
      ? "En cours"
      : s === "DELIVERING"
      ? "En livraison"
      : s === "DELIVERED"
      ? "Livré"
      : s ?? "—";

  // 🟩 Bouton vert à droite (QR)
  const RenderQRButton = ({ parcel }: { parcel: ParcelWithAssign }) => (
    <TouchableOpacity
      style={styles.qrButton}
      onPress={() => handleShowDeliveryQR(parcel)}
      disabled={qrBusyForId === String(parcel.id)}
      accessibilityRole="button"
      accessibilityLabel="Afficher le QR de validation de réception"
    >
      {qrBusyForId === String(parcel.id) ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.qrButtonText}>Valider (QR)</Text>
      )}
    </TouchableOpacity>
  );

  const renderPending = ({ item }: { item: Parcel }) => {
    const p = item as ParcelWithAssign;
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>📦 {fmt(p.type ?? "Colis")}</Text>
          {/* Bouton vert à droite */}
          <RenderQRButton parcel={p} />
        </View>

        {p.poids ? <Text style={styles.cardText}>Poids : {fmtKg(p.poids)}</Text> : null}
        {p.dimensions ? <Text style={styles.cardText}>Dimensions : {fmt(p.dimensions)}</Text> : null}
        {p.description ? <Text style={styles.cardText}>Description : {fmt(p.description)}</Text> : null}
        {p.adresseDepart ? <Text style={styles.cardText}>Départ : {fmt(p.adresseDepart)}</Text> : null}
        {p.adresseArrivee ? <Text style={styles.cardText}>Arrivée : {fmt(p.adresseArrivee)}</Text> : null}
      </View>
    );
  };

  const renderTaken = ({ item }: { item: ParcelWithAssign }) => {
    const who =
      item.courierName?.trim() ||
      (item.assignedTo ? `Livreur #${item.assignedTo.slice(0, 6)}…` : "—");

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>📦 {fmt(item.type ?? "Colis")}</Text>
          {/* Bouton vert à droite */}
          <RenderQRButton parcel={item} />
        </View>

        {item.description ? (
          <Text style={styles.cardText}>Description : {fmt(item.description)}</Text>
        ) : null}
        {item.adresseDepart ? (
          <Text style={styles.cardText}>Départ : {fmt(item.adresseDepart)}</Text>
        ) : null}
        {item.adresseArrivee ? (
          <Text style={styles.cardText}>Arrivée : {fmt(item.adresseArrivee)}</Text>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.badge}>Statut : {statusFR(item.status)}</Text>
          <Text style={styles.badge}>Pris en charge par : {who}</Text>
        </View>
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
            renderItem={renderPending}
          />
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

      {/* 🖼️ Modal plein écran avec le QR */}
      <Modal animationType="slide" visible={qrVisible} onRequestClose={() => setQrVisible(false)}>
        <View style={styles.qrContainer}>
          <View style={styles.qrHeader}>
            <Text style={styles.qrTitle}>QR de validation de réception</Text>
            <Pressable onPress={() => setQrVisible(false)}>
              <Text style={styles.qrClose}>Fermer ✕</Text>
            </Pressable>
          </View>

          <View style={styles.qrBody}>
            {qrError ? (
              <Text style={styles.qrError}>{qrError}</Text>
            ) : qrValue ? (
              <>
                <View style={styles.qrBox}>
                  <QRCode
                    value={qrValue}
                    size={Math.min(360, Math.round((typeof window !== "undefined" ? window.innerWidth : 360) * 0.8))}
                  />
                </View>
                <Text style={styles.qrHint}>
                  Montre ce QR au livreur pour valider la réception.
                </Text>
                {qrParcel?.id ? (
                  <Text style={styles.qrMeta}>Colis #{String(qrParcel.id).slice(0, 8)}…</Text>
                ) : null}
              </>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        </View>
      </Modal>
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { color: Colors.textOnCard, fontWeight: "600" },
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

  // CTA global (refresh)
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },

  // 🟩 Bouton QR à droite
  qrButton: {
    backgroundColor: "#1DB954", // vert style "validate"
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  qrButtonText: { color: "#fff", fontWeight: "700" },

  // Modal QR
  qrContainer: { flex: 1, backgroundColor: Colors.background, paddingTop: 16, paddingHorizontal: 16 },
  qrHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  qrTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  qrClose: { color: Colors.textOnCard },

  qrBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  qrBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderColor: Colors.border,
    borderWidth: 1,
  },
  qrHint: { color: Colors.textOnCard, opacity: 0.8, marginTop: 10 },
  qrMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  qrError: { color: "#ff6b6b", textAlign: "center" },
});