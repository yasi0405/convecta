import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ParcelProvider } from '@/context/ParcelContext';
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react-native";
import { Amplify } from "aws-amplify";
import * as LocalAuthentication from "expo-local-authentication";

import { IconSymbol } from "@/components/ui/IconSymbol";
import Colors from "@/theme/Colors";
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

// 🔹 Composant interne : utilise les hooks de contexte DANS les Providers
function AppShell() {
  const { signOut, authStatus } = useAuthenticator((context) => [context.authStatus]);    
  const theme = useTheme();   
  const pathname = usePathname();
  const segments = useSegments() as string[]; 
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);

  // Exemple de segments: ['(courier)', 'navigate'] ou ['(receiver)', 'home']
  const isCourier = segments?.includes('(courier)');
  const isLiveNav = pathname?.startsWith("/(courier)/navigate");
  const hideTopBar = pathname?.startsWith("/home/onboarding") || isLiveNav;
  const isProfile = pathname?.startsWith("/profile");

  const requestBiometric = useCallback(async () => {
    setBiometricBusy(true);
    setBiometricError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setBiometricVerified(true); // pas de biométrie dispo, on ne bloque pas
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Déverrouiller avec Face ID / empreinte",
        fallbackLabel: "Utiliser le code",
      });
      if (result.success) {
        setBiometricVerified(true);
      } else {
        setBiometricError("Authentification biométrique requise pour continuer");
      }
    } catch (e: any) {
      setBiometricError(e?.message || "Biométrie indisponible");
    } finally {
      setBiometricBusy(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      setBiometricVerified(false);
      requestBiometric();
    } else {
      setBiometricVerified(false);
      setBiometricError(null);
    }
  }, [authStatus, requestBiometric]);

  if (authStatus === "authenticated" && !biometricVerified) {
    return (
      <SafeAreaView style={[styles.container, styles.biometricGate]}>
        <View style={styles.biometricCard}>
          <IconSymbol name="faceid" color={Colors.accent} size={36} />
          <Text style={styles.biometricTitle}>Déverrouiller</Text>
          <Text style={styles.biometricSubtitle}>
            Utilise Face ID / empreinte pour accéder à ton compte.
          </Text>
          {biometricError ? <Text style={styles.biometricError}>{biometricError}</Text> : null}
          <View style={styles.biometricActions}>
            <TouchableOpacity
              style={[styles.bioButton, styles.bioPrimary, biometricBusy && { opacity: 0.6 }]}
              onPress={requestBiometric}
              disabled={biometricBusy}
            >
              <Text style={styles.bioPrimaryText}>{biometricBusy ? "Vérification…" : "Continuer"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bioButton, styles.bioSecondary]}
              onPress={() => signOut()}
              disabled={biometricBusy}
            >
              <Text style={styles.bioSecondaryText}>Changer de compte</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!hideTopBar && (
        <View style={[styles.topBar, { paddingTop: 0 }]}>
          {/* ✅ Switch global pour changer de rôle immédiatement */}
          {isProfile ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/" as Href)}
              accessibilityLabel="Retour à l'application"
            >
              <Text style={styles.backButtonText}>{"<- Retour App"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.modeSwitchRow}>
              {isCourier ? (
                <View style={[styles.modeIcon, styles.modeIconActive]}>
                  <IconSymbol name="truck.fill" color={Colors.accent} size={20} />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.modeIcon}
                  onPress={() => router.replace("/(courier)/navigate" as Href)}
                  accessibilityLabel="Basculer en mode livreur"
                >
                  <IconSymbol name="truck.fill" color={Colors.accent} size={20} />
                </TouchableOpacity>
              )}

              {!isCourier ? (
                <View style={[styles.modeIcon, styles.modeIconActive]}>
                  <IconSymbol name="cube.box.fill" color={Colors.accent} size={20} />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.modeIcon}
                  onPress={() => router.replace("/(receiver)/home" as Href)}
                  accessibilityLabel="Basculer en mode receveur"
                >
                  <IconSymbol name="cube.box.fill" color={Colors.accent} size={20} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.avatarButton} onPress={() => setMenuOpen(true)} accessibilityLabel="Ouvrir le menu utilisateur">
            <IconSymbol name="person.circle.fill" color={Colors.accent} size={20} />
          </TouchableOpacity>
        </View>
      )}

      <Stack
        screenOptions={{
          headerShown: false,        // on n’affiche aucun header natif
          headerBackVisible: false,  // et donc aucun bouton “back”
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>

      <StatusBar style="auto" />

      {menuOpen && (
        <View style={styles.menuOverlay}>
          <View style={styles.menuContent}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Mon compte</Text>
              <TouchableOpacity
                style={styles.menuClose}
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="Fermer le menu utilisateur"
              >
                <IconSymbol name="xmark.circle.fill" color={Colors.white} size={22} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                router.push("/profile" as Href);
              }}
            >
              <Text style={styles.menuItemText}>Profil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                signOut();
              }}
            >
              <Text style={[styles.menuItemText, { color: Colors.accent }]}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    'RussoOne-Regular': require('../assets/fonts/RussoOne-Regular.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ParcelProvider>
        <ThemeProvider>
          <Authenticator.Provider>
            <Authenticator>
              {/* ✅ Tous les hooks de contexte sont appelés dans AppShell */}
              <AppShell />
            </Authenticator>
          </Authenticator.Provider>
        </ThemeProvider>
      </ParcelProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    zIndex: 10,
  },
  button: {
    borderColor: Colors.accent,
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "bold",
  },
  switchButton: {
    borderColor: Colors.accent,
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  switchButtonText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "bold",
  },
  backButton: {
    borderColor: Colors.border,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "bold",
  },
  modeSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.input,
  },
  modeIconActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
  },
  avatarButton: {
    borderColor: Colors.border,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButtonText: {
    fontSize: 16,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: "flex-start",
    zIndex: 1000,
    elevation: 1000,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuClose: {
    padding: 8,
  },
  menuContent: {
    marginTop: 20,
    gap: 24,
  },
  menuTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: "700",
  },
  menuItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemText: {
    color: Colors.white,
    fontSize: 18,
  },
  biometricGate: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  biometricCard: {
    width: "100%",
    borderRadius: 18,
    padding: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  biometricTitle: { color: Colors.text, fontSize: 20, fontWeight: "800" },
  biometricSubtitle: { color: Colors.textSecondary },
  biometricError: { color: "#ff6b6b", fontWeight: "700" },
  biometricActions: { flexDirection: "row", gap: 12, marginTop: 6 },
  bioButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bioPrimary: { backgroundColor: Colors.accent },
  bioPrimaryText: { color: Colors.background, fontWeight: "800" },
  bioSecondary: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.input },
  bioSecondaryText: { color: Colors.text, fontWeight: "700" },
});
