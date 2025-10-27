import Colors from "@/constants/Colors";
import { Parcel } from "@/src/context/ParcelContext";
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
import QRCode from "react-native-qrcode-svg";

// 🧭 Navigation (adapter la route si besoin)
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// ⚙️ Typage souple (on ajoute owner + assignedTo + status)
type ParcelWithAssign = Parcel & {
  id?: string;
  owner?: string | null;
  status?:
    | "AVAILABLE"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "DELIVERING"
    | "DELIVERED"
    | "CANCELLED";
  assignedTo?: string | null;
  courierName?: string | null;
  adresseDepart?: string | null;
  adresseArrivee?: string | null;
  type?: string | null;
  description?: string | null;
  poids?: number | string | null;
  dimensions?: string | null;
};

const client = generateClient<any>();

export default function ParcelList() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 👇 NOUVEAU : Colis en attente (de CE client uniquement)
  const [myPendingParcels, setMyPendingParcels] = useState<ParcelWithAssign[]>([]);
  const [loadingMyPending, setLoadingMyPending] = useState(false);

  // ✅ Colis pris en charge (de CE client) — utile pour QR
  const [takenParcels, setTakenParcels] = useState<ParcelWithAssign[]>([]);
  const [loadingTaken, setLoadingTaken] = useState(false);

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

  // 🔎 NOUVEAU : charge les colis créés par CE client et encore disponibles (non pris)
  const loadMyPendingParcels = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingMyPending(true);
    try {
      const res = await client.models.Parcel.list({
        filter: {
          owner: { eq: currentUserId },
          and: [
            {
              or: [
                { status: { eq: "AVAILABLE" } },
                { status: { eq: null as any } }, // tolérance si le status n'est pas encore défini
              ],
            },
            {
              or: [
                { assignedTo: { attributeExists: false } as any },
                { assignedTo: { eq: null as any } },
                { assignedTo: { eq: "" as any } },
              ],
            },
          ],
        },
        limit: 100,
        authMode: "userPool",
      });

      const items: ParcelWithAssign[] =
        (res?.data as ParcelWithAssign[]) ??
        ((res as any)?.items as ParcelWithAssign[]) ??
        [];

      setMyPendingParcels(items);
    } catch (e) {
      console.log("loadMyPendingParcels error:", e);
    } finally {
      setLoadingMyPending(false);
    }
  }, [currentUserId]);

  // 🔎 Colis pris en charge (ASSIGNED / IN_PROGRESS / DELIVERING)
  const loadTakenParcels = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingTaken(true);
    try {
      const res = await client.models.Parcel.list({
        filter: {
          owner: { eq: currentUserId },
          or: [
            { status: { eq: "ASSIGNED" } },
            { status: { eq: "IN_PROGRESS" } },
            { status: { eq: "DELIVERING" } },
          ],
        },
        limit: 100,
        authMode: "userPool",
      });

      const items: ParcelWithAssign[] =
        (res?.data as ParcelWithAssign[]) ??
        ((res as any)?.items as ParcelWithAssign[]) ??
        [];

      setTakenParcels(items);
    } catch (e) {
      console.log("loadTakenParcels error:", e);
    } finally {
      setLoadingTaken(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadMyPendingParcels();
    loadTakenParcels();
  }, [loadMyPendingParcels, loadTakenParcels]);

  // ▶️ Génère un code signé infalsifiable pour finaliser la réception (purpose = DELIVERY)
  const handleShowDeliveryQR = async (p: ParcelWithAssign) => {
    if (!p?.id) return;
    setQrError(null);
    setQrBusyForId(String(p.id));
    try {
      const resp = await (client as any).mutations.generateScanCode({
        parcelId: String(p.id),
        purpose: "DELIVERY",
        authMode: "userPool",
      });

      const payload = resp?.data?.generateScanCode ?? resp?.data ?? resp;
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

  // ✏️ Bouton "Modifier" — renvoie vers /home avec les données en paramètre `prefill`
  const handleEditParcel = (p: ParcelWithAssign) => {
    if (!p?.id) return;

    // On limite aux champs utiles pour pré-remplir ton formulaire de /home
    const prefill = {
      id: p.id,
      type: p.type ?? "",
      description: p.description ?? "",
      poids: p.poids ?? "",
      dimensions: p.dimensions ?? "",
      adresseDepart: p.adresseDepart ?? "",
      adresseArrivee: p.adresseArrivee ?? "",
      status: p.status ?? "",
    };

    // Expo Router encode déjà les params, mais on sécurise en JSON.stringify
    const prefillStr = JSON.stringify(prefill);

    router.push({
      pathname: "/home", // le /home du client (dans le groupe (receiver))
      params: { prefill: prefillStr },
    });
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

  // 🟩 Bouton QR (utilisé pour la section "pris en charge")
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

  // ✏️ Bouton Modifier
  const RenderEditButton = ({ parcel }: { parcel: ParcelWithAssign }) => (
    <TouchableOpacity
      style={styles.editButton}
      onPress={() => handleEditParcel(parcel)}
      accessibilityRole="button"
      accessibilityLabel="Modifier les informations du colis"
    >
      <Text style={styles.editButtonText}>Modifier</Text>
    </TouchableOpacity>
  );

  // Rendu d’un colis EN ATTENTE (du client) — bouton Modifier
  const renderMyPending = ({ item }: { item: ParcelWithAssign }) => {
    const p = item;
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>📦 {fmt(p.type ?? "Colis")}</Text>
          {/* Bouton Modifier à droite */}
          <RenderEditButton parcel={p} />
        </View>

        {p.poids ? <Text style={styles.cardText}>Poids : {fmtKg(p.poids)}</Text> : null}
        {p.dimensions ? <Text style={styles.cardText}>Dimensions : {fmt(p.dimensions)}</Text> : null}
        {p.description ? <Text style={styles.cardText}>Description : {fmt(p.description)}</Text> : null}
        {p.adresseDepart ? <Text style={styles.cardText}>Départ : {fmt(p.adresseDepart)}</Text> : null}
        {p.adresseArrivee ? <Text style={styles.cardText}>Arrivée : {fmt(p.adresseArrivee)}</Text> : null}
        <Text style={[styles.badge, { alignSelf: "flex-start", marginTop: 6 }]}>
          Statut : {statusFR(p.status)}
        </Text>
      </View>
    );
  };

  // Rendu d’un colis PRIS EN CHARGE — bouton QR
  const renderTaken = ({ item }: { item: ParcelWithAssign }) => {
    const who =
      item.courierName?.trim() ||
      (item.assignedTo ? `Livreur #${item.assignedTo.slice(0, 6)}…` : "—");

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>📦 {fmt(item.type ?? "Colis")}</Text>
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
      {/* 🟡 Colis en attente (créés par CE client et non pris) */}
      <Text style={styles.title}>Colis en attente</Text>

      {myPendingParcels.length === 0 ? (
        <Text style={styles.cardText}>
          {loadingMyPending ? "Chargement..." : "Aucun colis en attente."}
        </Text>
      ) : (
        <>
          <FlatList
            data={myPendingParcels}
            keyExtractor={(item, index) => (item as any)?.id ?? `pending-${index}`}
            renderItem={renderMyPending}
          />
          <TouchableOpacity style={styles.button} onPress={loadMyPendingParcels}>
            <Text style={styles.buttonText}>{loadingMyPending ? "Chargement…" : "Rafraîchir les colis en attente"}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 🔥 Colis de ce client déjà pris en charge */}
      <Text style={[styles.title, { marginTop: 28 }]}>Colis pris en charge</Text>
      {takenParcels.length === 0 ? (
        <Text style={styles.cardText}>
          {loadingTaken ? "Chargement..." : "Aucun colis pris en charge pour le moment."}
        </Text>
      ) : (
        <>
          <FlatList
            data={takenParcels}
            keyExtractor={(item, index) => (item as any)?.id ?? `taken-${index}`}
            renderItem={renderTaken}
          />
          <TouchableOpacity style={styles.button} onPress={loadTakenParcels}>
            <Text style={styles.buttonText}>{loadingTaken ? "Chargement…" : "Rafraîchir les colis pris en charge"}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 🖼️ Modal plein écran avec le QR */}
      <Modal animationType="slide" visible={qrVisible} onRequestClose={() => setQrVisible(false)}>
        <SafeAreaView style={styles.qrContainer} edges={["top","right","bottom","left"]}>
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
        </SafeAreaView>
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

  // 🟩 Bouton QR (section pris en charge)
  qrButton: {
    backgroundColor: "#1DB954",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  qrButtonText: { color: "#fff", fontWeight: "700" },

  // ✏️ Bouton Modifier (section en attente)
  editButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  editButtonText: { color: Colors.textOnCard, fontWeight: "700" },

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