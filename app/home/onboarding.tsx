// app/home/onboarding.tsx
import { updateProfile, uploadKycImage } from "@/features/user/api";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Button, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
// (placeholders pour capture + OCR – tu pourras brancher VisionCamera/ocr)

// hook local: scan du recto + auto-remplissage via OCR (placeholder simple)
function useIdScanAutoFill(
  onImage: (uri: string) => void,
  onFields: (data: { first_name?: string; last_name?: string; address?: string }) => void
) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  async function ensurePermission(): Promise<boolean> {
    if (permission?.granted) return true;
    const res = await requestPermission();
    return !!res.granted;
  }

  // ── OCR très simplifié (placeholder): à remplacer par ML Kit / VisionCamera
  async function extractOcrFieldsFromImage(uri: string): Promise<{
    first_name?: string;
    last_name?: string;
    address?: string;
  }> {
    let TextRecognition: any;
    try {
      // Dynamic import so the app still runs in Expo Go without the native module
      const mod = await import("@react-native-ml-kit/text-recognition");
      TextRecognition = mod?.default ?? mod;
    } catch (e) {
      console.warn("ML Kit not available (Expo Go?)", e);
      Alert.alert(
        "OCR non disponible",
        "L'analyse on-device nécessite un build Dev Client (prebuild) ou un APK/IPA. Je remplis les champs manuellement.",
      );
      return {};
    }

    const result = await TextRecognition.recognize(uri);
    const fullText = (result?.text || "").replace(/\t/g, " ");
    const lines = fullText
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter(Boolean);

    let first_name: string | undefined;
    let last_name: string | undefined;
    let address: string | undefined;

    for (const l of lines) {
      if (/^[A-ZÉÈÀÂÎÏÔÛÇ][A-ZÉÈÀÂÎÏÔÛÇ\-']+\s+[A-ZÉÈÀÂÎÏÔÛÇ][A-ZÉÈÀÂÎÏÔÛÇ\-']+$/.test(l)) {
        const [ln, fn] = l.split(/\s+/);
        last_name = ln;
        first_name = fn;
        break;
      }
    }

    const idx = lines.findIndex((l: string) => /\d+\s+.*(RUE|AVENUE|BD|BOULEVARD|CHAUSS[ÉE]E|CHEMIN|PLACE|ROUTE|ALL[ÉE]E)/i.test(l));
    if (idx >= 0) {
      address = [lines[idx], lines[idx + 1]].filter(Boolean).join(", ");
    }

    return { first_name, last_name, address };
  }

  async function captureFromCamera() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        setShowCamera(false);
        onImage(photo.uri);
        setOcrLoading(true);
        const fields = await extractOcrFieldsFromImage(photo.uri);
        setOcrLoading(false);
        onFields(fields);
        if (!fields.first_name && !fields.last_name && !fields.address) {
          Alert.alert("OCR", "Aucune donnée lue automatiquement. Tu peux compléter manuellement.");
        }
      }
    } catch (e) {
      setOcrLoading(false);
      console.warn("Camera capture error", e);
      Alert.alert("Erreur", "Capture impossible. Réessaie.");
    }
  }

  async function scanFront() {
    const ok = await ensurePermission();
    if (!ok) {
      Alert.alert("Permission requise", "Autorise l'accès à la caméra pour scanner ta carte.");
      return;
    }
    setShowCamera(true);
  }

  return { scanFront, showCamera, setShowCamera, cameraRef, captureFromCamera, ocrLoading };
}

export default function Onboarding() {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [address, setAddress] = useState("");
  const [frontUri, setFrontUri] = useState<string | undefined>();

  const { scanFront, showCamera, setShowCamera, cameraRef, captureFromCamera, ocrLoading } = useIdScanAutoFill(
    (uri) => setFrontUri(uri),
    ({ first_name, last_name, address }) => {
      if (first_name) setFirst(first_name);
      if (last_name) setLast(last_name);
      if (address) setAddress(address);
    }
  );

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
      {showCamera && (
        <View style={{ gap: 12 }}>
          <View style={{ height: 480, borderRadius: 16, overflow: "hidden" }}>
            <CameraView
              ref={(r) => (cameraRef.current = r)}
              style={{ flex: 1 }}
              facing="back"
              enableTorch={false}
            />
            {/* Bouton fermer (coin haut-gauche) */}
            <TouchableOpacity
              onPress={() => setShowCamera(false)}
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.4)",
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityLabel="Fermer la caméra"
            >
              <Text style={{ color: "#fff", fontSize: 22, lineHeight: 22 }}>✕</Text>
            </TouchableOpacity>
            {/* Bouton déclencheur rond (bas-centre) */}
            <View
              style={{
                position: "absolute",
                bottom: 24,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TouchableOpacity
                onPress={captureFromCamera}
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 39,
                  borderWidth: 6,
                  borderColor: "#fff",
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
                accessibilityLabel="Prendre la photo"
              />
            </View>
          </View>
        </View>
      )}
      <TextInput placeholder="Prénom" value={first_name} onChangeText={setFirst} />
      <TextInput placeholder="Nom" value={last_name} onChangeText={setLast} />
      <TextInput placeholder="Adresse" value={address} onChangeText={setAddress} />
      <Button title="Scanner recto carte" onPress={scanFront} />
      {frontUri && (
        <View style={{ gap: 8 }}>
          <Image source={{ uri: frontUri }} style={{ height: 120 }} />
          {ocrLoading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator />
              <Text>Analyse du document…</Text>
            </View>
          )}
        </View>
      )}
      <Button title="Enregistrer" onPress={onSave} disabled={!first_name || !last_name || !address || ocrLoading} />
    </View>
  );
}