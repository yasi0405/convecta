import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Colors from "@/theme/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { handleEditParcel } from "../services/parcels";
import { styles } from "../styles";
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
  const fmtKg = (v?: number | string | null) => (v ? `${v} kg` : "—");
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

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.cardTitleRow}>
          <IconSymbol name="cube.box.fill" size={18} color={Colors.accent} />
          <Text style={styles.cardTitleText}>{fmt(parcel.type ?? "Colis")}</Text>
        </View>
        {mode === "pending" ? (
          <TouchableOpacity style={styles.editButton} onPress={() => handleEditParcel(parcel)}>
            <Text style={styles.editButtonText}>Modifier</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.qrButton} onPress={() => onShowQr?.(parcel)}>
            <Text style={styles.qrButtonText}>Valider (QR)</Text>
          </TouchableOpacity>
        )}
      </View>
      {parcel.adresseDepart ? <Text style={styles.cardText}>Départ : {fmt(parcel.adresseDepart)}</Text> : null}
      {parcel.adresseArrivee ? <Text style={styles.cardText}>Arrivée : {fmt(parcel.adresseArrivee)}</Text> : null}
      <Text style={styles.badge}>Statut : {statusFR(parcel.status)}</Text>
    </View>
  );
}
