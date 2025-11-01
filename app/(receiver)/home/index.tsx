import Colors from "@/constants/Colors";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AddressField } from "./_components/AddressField";
import { EstimateCard } from "./_components/EstimateCard";
import { UserAutocomplete } from "./_components/UserAutocomplete";

import { useAddressAutocomplete } from "./_hooks/useAddressAutocomplete";
import { useEstimate } from "./_hooks/useEstimate";
import { createParcel, updateParcel } from "./_services/parcel";

import type { RecipientMode, RecipientUser } from "./types";

const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}\n\n${msg}`) : Alert.alert(title, msg);

export default function HomeScreen() {
  const router = useRouter();

  // Form
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [poids, setPoids] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);

  const [adresseDepart, setAdresseDepart] = useState("");
  const [adresseArrivee, setAdresseArrivee] = useState("");

  const dep = useAddressAutocomplete(adresseDepart);
  const arr = useAddressAutocomplete(adresseArrivee);

  const [recipientMode, setRecipientMode] = useState<RecipientMode>("address");
  const [selectedUser, setSelectedUser] = useState<RecipientUser | null>(null);
  const [useUserDefaultAddress, setUseUserDefaultAddress] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loading, err, durationSec, distanceM, commissionEUR } = useEstimate(adresseDepart, adresseArrivee);

  const handleSubmit = async () => {
    if (!adresseDepart?.trim()) return setError("Ajoute une adresse de départ.");
    if (recipientMode === "address") {
      if (!adresseArrivee?.trim()) return setError("Ajoute une adresse d’arrivée (ou choisis un destinataire).");
    } else if (recipientMode === "user") {
      if (!selectedUser) return setError("Choisis un destinataire (Client B).");
    }

    const poidsNormalized = poids?.trim().replace(",", ".");
    const poidsNum = poidsNormalized ? parseFloat(poidsNormalized) : undefined;

    try {
      setSubmitting(true);
      setError(null);

      if (isEdit && editId) {
        const id = await updateParcel({
          id: editId,
          poids: poidsNum,
          dimensions,
          description,
          adresseDepart,
          adresseArrivee,
        });
        router.replace({ pathname: "/(receiver)/home/summary", params: { id, updated: "1" } });
        return;
      }

      const receiver = selectedUser?.id;
      const arrivalLabel =
        recipientMode === "address"
          ? (adresseArrivee ?? "").trim()
          : (useUserDefaultAddress ? (selectedUser?.defaultAddressLabel ?? "") : (adresseArrivee ?? "").trim());
      const statusForFlow = selectedUser ? "AWAITING_RECEIVER_CONFIRMATION" : "AVAILABLE";

      const id = await createParcel({
        poids: poidsNum,
        dimensions,
        description,
        adresseDepart,
        adresseArrivee: arrivalLabel,
        receiverId: receiver,
        status: statusForFlow,
      });

      // reset soft
      setType(""); setPoids(""); setDimensions(""); setDescription("");
      setAdresseDepart(""); setAdresseArrivee("");
      setRecipientMode("address"); setSelectedUser(null); setUseUserDefaultAddress(true);

      router.replace({ pathname: "/(receiver)/home/summary", params: { id } });
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la création du colis");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 80 }]} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.headerRow}>
        <Text style={styles.title}>{isEdit ? "Modifier le colis" : "Nouveau colis"}</Text>
        <TouchableOpacity style={styles.newButton} onPress={() => {
          // reset rapide "nouveau"
          setIsEdit(false); setEditId(null);
          setType(""); setPoids(""); setDimensions(""); setDescription("");
          setAdresseDepart(""); setAdresseArrivee("");
          setRecipientMode("address"); setSelectedUser(null); setUseUserDefaultAddress(true);
        }}>
          <Text style={styles.newButtonText}>🆕 Nouveau colis</Text>
        </TouchableOpacity>
      </View>

      <AddressField
        label="Adresse de départ"
        value={adresseDepart}
        onChange={setAdresseDepart}
        suggestions={dep.suggestions}
        clearSuggestions={() => dep.setSuggestions([])}
        showGPS={false}
      />

      <Text style={styles.label}>Destinataire</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <TouchableOpacity
          style={[styles.toggleBtn, recipientMode === "address" && styles.toggleBtnActive]}
          onPress={() => setRecipientMode("address")}
        >
          <Text style={[styles.toggleLabel, recipientMode === "address" && styles.toggleLabelActive]}>Adresse</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, recipientMode === "user" && styles.toggleBtnActive]}
          onPress={() => setRecipientMode("user")}
        >
          <Text style={[styles.toggleLabel, recipientMode === "user" && styles.toggleLabelActive]}>Utilisateur</Text>
        </TouchableOpacity>
      </View>

      {recipientMode === "user" ? (
        <UserAutocomplete
          value={selectedUser}
          onSelect={(u) => {
            setSelectedUser(u);
            // si adresse par défaut connue, la préremplir
            // (tu peux ajouter un toggle si besoin)
          }}
        />
      ) : null}

      {(recipientMode === "address") || (recipientMode === "user" && !selectedUser?.defaultAddressLabel) ? (
        <AddressField
          label="Adresse d’arrivée"
          value={adresseArrivee}
          onChange={setAdresseArrivee}
          suggestions={arr.suggestions}
          clearSuggestions={() => arr.setSuggestions([])}
        />
      ) : null}

      <Text style={styles.label}>Poids (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="ex: 1.2"
        value={poids}
        onChangeText={setPoids}
        keyboardType="numeric"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={styles.label}>Dimensions (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="ex: 40×30×20"
        value={dimensions}
        onChangeText={setDimensions}
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="Contenu, précautions, etc."
        value={description}
        onChangeText={setDescription}
        placeholderTextColor={Colors.textSecondary}
      />

      <EstimateCard
        loading={loading}
        err={err}
        durationSec={durationSec}
        distanceM={distanceM}
        commissionEUR={commissionEUR}
      />

      <TouchableOpacity style={[styles.button, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>
          {submitting ? (isEdit ? "Mise à jour…" : "Création…") : (isEdit ? "Mettre à jour" : "Valider")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: Colors.background, flexGrow: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  title: { fontSize: 22, textAlign: "left", color: Colors.text, flex: 1 },
  newButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  newButtonText: { color: Colors.textOnCard, fontWeight: "700" },
  label: { color: Colors.text, marginBottom: 6, marginTop: 10, fontWeight: "600" },
  error: { color: "#b00020", marginBottom: 8, fontWeight: "700" },
  input: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8, color: Colors.text },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 10, alignItems: "center", backgroundColor: Colors.input },
  toggleBtnActive: { backgroundColor: Colors.card, borderColor: Colors.button },
  toggleLabel: { color: Colors.textOnCard, fontWeight: "600" },
  toggleLabelActive: { color: Colors.button, fontWeight: "700" },
  button: { backgroundColor: Colors.button, paddingVertical: 14, borderRadius: 8, marginTop: 8, alignItems: "center" },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },
});