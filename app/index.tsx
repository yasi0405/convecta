import Colors from "@/constants/Colors";
import { useAuthenticator } from "@aws-amplify/ui-react-native";
import { Asset } from "expo-asset";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SvgUri } from "react-native-svg";

export const unstable_settings = {
  initialRouteName: "index",
};

export const screenOptions = {
  tabBarStyle: { display: "none" },
};

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuthenticator();

  const [center, setCenter] = useState<[number, number]>([4.3517, 50.8503]); // [lng, lat] Bruxelles par défaut
  const [zoom, setZoom] = useState(12);
  const [mode, setMode] = useState<"courier" | "receiver">("receiver");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return; // garde le fallback Bruxelles
        const pos = await Location.getCurrentPositionAsync({});
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        if (isMounted && Number.isFinite(lng) && Number.isFinite(lat)) {
          setCenter([lng, lat]);
          setZoom(12);
        }
      } catch (e) {
        // ignore: fallback to Bruxelles
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const logoUri = Asset.fromModule(require("../assets/images/logo.svg")).uri;

  return (
    <View style={styles.container}>
      <SvgUri
        uri={logoUri}
        width={200}
        height={200}
        style={styles.logo}
      />
      <View style={styles.mapContainer}>
        <img
          src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center[0]},${center[1]},${zoom},0/800x600?access_token=${process.env.EXPO_PUBLIC_MAPBOX_TOKEN}`}
          alt="Carte de la ville"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <View style={styles.modeCard}>
          <View style={styles.switchRow}>
            <Text style={styles.modeText}>Récepteur</Text>
            <Switch
              value={mode === "courier"}
              onValueChange={(val) => setMode(val ? "courier" : "receiver")}
            />
            <Text style={styles.modeText}>Livreur</Text>
          </View>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => router.replace(`/${mode}` as any)}
          >
            <Text style={styles.confirmButtonText}>Confirmer</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/new")}
      >
        <Text style={styles.buttonText}>Nouveau colis</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/pending")}
      >
        <Text style={styles.buttonText}>Colis en attente</Text>
      </TouchableOpacity> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 20,
  },
  logo: {
    height: 40,
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 20,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: "bold",
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: {
    flex: 1,
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent, // green pin matching your theme
    borderWidth: 2,
    borderColor: Colors.card,
  },
  modeCard: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    transform: [{ translateY: -50 }],
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    zIndex: 10,
  },
  modeText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    marginTop: 10,
    backgroundColor: Colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  confirmButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});