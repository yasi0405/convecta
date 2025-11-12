import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Colors from "@/theme/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { handleEditParcel } from "../services/parcels";
import { ParcelWithAssign } from "../types";

export default function ParcelCard({
  parcel,
  mode,
  onShowQr,
}: {
  parcel: ParcelWithAssign;
  mode: "pending" | "taken";
  onShowQr?: (parcel: ParcelWithAssign) => void;
}) {
  const fmt = (v?: string | number | null) => (v == null || v === "" ? "—" : String(v));
  const statusFR = (s?: ParcelWithAssign["status"]) =>
    s === "AVAILABLE"
      ? "Disponible"
      : s === "ASSIGNED"
      ? "Assigné"
      : s === "IN_PROGRESS"
      ? "En cours"
      : s === "DELIVERING"
      ? "En livraison"
      : s === "DELIVERED"
      ? "Livré"
      : s === "CANCELLED"
      ? "Annulé"
      : "—";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>{fmt(parcel.type ?? parcel.id ?? "Colis")}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusFR(parcel.status)}</Text>
        </View>
      </View>

      <View style={styles.infoStack}>
        <InfoRow icon="mappin.and.ellipse" label="Départ" value={parcel.adresseDepart} />
        <InfoRow icon="house.fill" label="Arrivée" value={parcel.adresseArrivee} />
        <InfoRow icon="cube.box.fill" label="Type" value={parcel.type} />
      </View>

      <View style={styles.actions}>
        {mode === "pending" ? (
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => handleEditParcel(parcel)}>
            <Text style={styles.btnGhostLabel}>Modifier</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => onShowQr?.(parcel)}>
            <Text style={styles.btnPrimaryLabel}>Valider (QR)</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof IconSymbol>["name"]; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <IconSymbol name={icon} size={16} color={Colors.accent} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    marginBottom: 16,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  infoStack: { gap: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { color: Colors.textSecondary, fontSize: 13 },
  infoText: { color: Colors.text, flex: 1 },
  actions: { flexDirection: "row", justifyContent: "flex-end" },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  btnGhost: { borderWidth: 1, borderColor: Colors.border },
  btnGhostLabel: { color: Colors.text, fontWeight: "600" },
  btnPrimary: { backgroundColor: Colors.button },
  btnPrimaryLabel: { color: Colors.buttonText, fontWeight: "700" },
});
