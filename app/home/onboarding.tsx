// app/home/onboarding.tsx
import { updateProfile, uploadKycImage } from "@/features/user/api";
import React, { useState } from "react";
import { Alert, Button, Image, TextInput, View } from "react-native";
// (placeholders pour capture + OCR – tu pourras brancher VisionCamera/ocr)
export default function Onboarding() {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [address, setAddress] = useState("");
  const [frontUri, setFrontUri] = useState<string | undefined>();

  async function onSave() {
    if (!first_name || !last_name || !address) return Alert.alert("Champs requis");
    await updateProfile({ first_name, last_name, address });
    if (frontUri) {
      const url = await uploadKycImage(frontUri, "front.jpg");
      console.log("Uploaded:", url);
    }
    Alert.alert("OK", "Profil enregistré. Vérification en cours.");
  }

  return (
    <View style={{ padding:16, gap:12 }}>
      <TextInput placeholder="Prénom" value={first_name} onChangeText={setFirst} />
      <TextInput placeholder="Nom" value={last_name} onChangeText={setLast} />
      <TextInput placeholder="Adresse" value={address} onChangeText={setAddress} />
      {/* TODO: bouton 'Scanner recto carte' qui alimente frontUri */}
      {frontUri && <Image source={{ uri: frontUri }} style={{ height: 120 }} />}
      <Button title="Enregistrer" onPress={onSave} />
    </View>
  );
}