import { ensureAmplifyConfigured } from "@/lib/amplify";
import 'react-native-get-random-values';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';
ensureAmplifyConfigured();

import { IconSymbol } from "@/components/ui/IconSymbol";
import { ParcelProvider } from '@/context/ParcelContext';
import Colors from "@/theme/Colors";
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { NativeModules, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, Animated, Easing, Alert, TouchableWithoutFeedback, Keyboard, Modal } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
type LocalAuthModule = typeof import("expo-local-authentication");
type BiometricContextValue = {
  requestBiometric: () => Promise<void>;
  biometricVerified: boolean;
  biometricError: string | null;
  biometricBusy: boolean;
};
type AuthContainerProps = {
  children?: React.ReactNode;
  alwaysBounceVertical?: boolean;
};

const { Authenticator, useAuthenticator } =
  require("@aws-amplify/ui-react-native") as typeof import("@aws-amplify/ui-react-native");
const {
  ThemeProvider: AmplifyThemeProvider,
} = require("@aws-amplify/ui-react-native/dist/theme") as typeof import("@aws-amplify/ui-react-native/dist/theme");
const { SignIn: AmplifySignIn } =
  require("@aws-amplify/ui-react-native/dist/Authenticator/Defaults") as typeof import("@aws-amplify/ui-react-native/dist/Authenticator/Defaults");
type AmplifyTheme = import("@aws-amplify/ui-react-native/dist/theme").Theme;
type StoredCreds = { username?: string; password?: string };

const CREDENTIALS_KEY = "convecta_lastCredentials";
const latestCredentialsRef: { current: StoredCreds | null } = { current: null };

async function saveCredentials(creds: StoredCreds) {
  try {
    if (!creds.username || !creds.password) return;
    const opts: SecureStore.SecureStoreOptions = {
      keychainService: CREDENTIALS_KEY,
      requireAuthentication: true,
      authenticationPrompt: "Face ID / Touch ID",
    };
    await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(creds), opts);
  } catch (e) {
    console.warn("SecureStore saveCredentials failed", e);
  }
}

async function loadCredentials(): Promise<StoredCreds | null> {
  try {
    const opts: SecureStore.SecureStoreOptions = {
      keychainService: CREDENTIALS_KEY,
      requireAuthentication: true,
      authenticationPrompt: "Face ID / Touch ID",
    };
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, opts);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("SecureStore loadCredentials failed", e);
    return null;
  }
}

const headingStyles = {
  text: { color: Colors.text, fontFamily: "Inter-Regular" },
  1: { fontSize: 24, fontWeight: "800" },
  2: { fontSize: 20, fontWeight: "800" },
  3: { fontSize: 18, fontWeight: "700" },
  4: { fontSize: 16, fontWeight: "700" },
  5: { fontSize: 15, fontWeight: "700" },
  6: { fontSize: 14, fontWeight: "700" },
} as const;

const fieldStyles = {
  container: { width: "100%" },
  fieldContainer: {
    backgroundColor: Colors.input,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  field: {
    color: Colors.text,
    fontFamily: "Inter-Regular",
    fontSize: 15,
  },
  label: {
    color: Colors.textSecondary,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    marginBottom: 6,
  },
} as const;

const amplifyAuthTheme: AmplifyTheme = {
  tokens: {
    colors: {
      background: {
        primary: Colors.background,
        secondary: Colors.card,
        tertiary: Colors.input,
        disabled: Colors.card,
      },
      font: {
        primary: Colors.text,
        secondary: Colors.textSecondary,
        inverse: Colors.buttonText,
        interactive: Colors.accent,
        active: Colors.accent,
      },
      border: {
        primary: Colors.border,
        focus: Colors.accent,
        pressed: Colors.accent,
      },
      primary: {
        10: Colors.accent,
        20: Colors.accent,
        40: Colors.accent,
        60: Colors.accent,
        80: Colors.accent,
        90: Colors.accent,
        100: Colors.accent,
      },
      brand: {
        primary: {
          10: Colors.accent,
          20: Colors.accent,
          40: Colors.accent,
          60: Colors.accent,
          80: Colors.accent,
          90: Colors.accent,
          100: Colors.accent,
        },
      },
    },
    space: {
      xxs: 6,
      xs: 10,
      small: 14,
      medium: 18,
      large: 24,
      xl: 28,
      xxl: 32,
      xxxl: 40,
    },
  },
  components: {
    button: {
      container: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignSelf: "stretch" },
      containerPrimary: { backgroundColor: Colors.accent },
      containerLink: { paddingVertical: 8, paddingHorizontal: 8, alignSelf: "center" },
      text: { fontWeight: "700", fontFamily: "Inter-Regular", fontSize: 15 },
      textPrimary: { color: Colors.buttonText, fontWeight: "800", fontFamily: "Inter-Regular", fontSize: 15 },
      textLink: { color: Colors.accent, fontWeight: "700", fontFamily: "Inter-Regular", fontSize: 15 },
    },
    textField: {
      ...fieldStyles,
    },
    passwordField: {
      ...fieldStyles,
    },
    heading: () => headingStyles,
    label: {
      text: { color: Colors.textSecondary, fontFamily: "Inter-Regular", fontSize: 13, fontWeight: "600" },
      primary: { color: Colors.text },
      secondary: { color: Colors.textSecondary },
    },
  },
};

const BiometricContext = createContext<BiometricContextValue | null>(null);

function useBiometric() {
  const ctx = useContext(BiometricContext);
  if (!ctx) throw new Error("Biometric context missing");
  return ctx;
}

function BiometricProvider({ children }: { children: ReactNode }) {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [localAuth, setLocalAuth] = useState<LocalAuthModule | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (Platform.OS === "web" || !NativeModules.ExpoLocalAuthentication) {
          if (active) setLocalAuth(null);
          return;
        }
        const mod = await import("expo-local-authentication");
        if (active) setLocalAuth(mod);
      } catch (e) {
        console.log("LocalAuthentication unavailable:", e);
        if (active) setLocalAuth(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setBiometricVerified(false);
      setBiometricError(null);
    }
  }, [authStatus]);

  // Après authentification réussie, on enregistre les derniers credentials pour un préremplissage futur
  useEffect(() => {
    if (authStatus === "authenticated" && latestCredentialsRef.current) {
      saveCredentials(latestCredentialsRef.current);
      latestCredentialsRef.current = null;
    }
  }, [authStatus]);

  const requestBiometric = useCallback(async () => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    setBiometricError(null);
    try {
      if (!localAuth) {
        // Module absent (e.g., dev build without native module) → don't block the user
        setBiometricVerified(true);
        return;
      }
      const hasHardware = await localAuth.hasHardwareAsync();
      const enrolled = await localAuth.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setBiometricVerified(true); // pas de biométrie dispo, on ne bloque pas
        return;
      }
      if (Platform.OS === "ios") {
        Alert.alert("Face ID", "Test Face ID : lancement de l'authentification.");
      }
      const result = await localAuth.authenticateAsync({
        promptMessage: "Déverrouiller avec Face ID / empreinte",
        fallbackLabel: "Utiliser le code",
      });
      if (result.success) {
        setBiometricVerified(true);
        Alert.alert("Face ID", "Succès Face ID / Touch ID.");
      } else {
        setBiometricError("Authentification biométrique requise pour continuer");
        Alert.alert("Face ID", "Échec ou annulé. Réessaie.");
      }
    } catch (e: any) {
      setBiometricError(e?.message || "Biométrie indisponible");
      Alert.alert("Face ID", e?.message || "Erreur biométrique.");
    } finally {
      setBiometricBusy(false);
    }
  }, [biometricBusy, localAuth]);

  const value: BiometricContextValue = {
    biometricBusy,
    biometricError,
    biometricVerified,
    requestBiometric,
  };

  return <BiometricContext.Provider value={value}>{children}</BiometricContext.Provider>;
}

function AuthenticatorBiometricWatcher() {
  const { route, authStatus } = useAuthenticator((context) => [context.route, context.authStatus]);
  const { biometricVerified, requestBiometric, biometricBusy } = useBiometric();
  const hasPrompted = useRef(false);
  const prevAuth = useRef(authStatus);

  useEffect(() => {
    if (authStatus !== prevAuth.current) {
      hasPrompted.current = false;
      prevAuth.current = authStatus;
    }
  }, [authStatus]);

  useEffect(() => {
    const onSignInScreen = route === "signIn";
    if (authStatus !== "unauthenticated") return;
    if (biometricVerified || biometricBusy || hasPrompted.current) return;
    hasPrompted.current = true;
    requestBiometric();
  }, [authStatus, route, biometricVerified, biometricBusy, requestBiometric]);

  return null;
}

function AuthContainer({ children }: AuthContainerProps) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={{ paddingHorizontal: 18, paddingVertical: 32, flex: 1 }}>
            <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
              {children}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

function ModeSwitch({ isCourier, onToggle }: { isCourier: boolean; onToggle: () => void }) {
  const anim = useRef(new Animated.Value(isCourier ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isCourier ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.circle),
      useNativeDriver: true,
    }).start();
  }, [anim, isCourier]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 38] });
  const trackTint = isCourier ? Colors.cardAccent : Colors.border;

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.modeSwitch, { borderColor: Colors.accent, backgroundColor: Colors.input }]}
      accessibilityLabel={isCourier ? "Basculer en mode client" : "Basculer en mode livreur"}
    >
      <View style={[styles.modeThumbWrapper, { backgroundColor: trackTint, borderRadius: 16 }]}>
        <Animated.View style={[styles.modeThumb, { transform: [{ translateX }] }]}>
          <IconSymbol name={isCourier ? "truck.fill" : "cube.box.fill"} color={Colors.accent} size={18} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

function FaceIdTestButton() {
  const [status, setStatus] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    try {
      const mod = await import("expo-local-authentication");
      const hasHardware = await mod.hasHardwareAsync();
      const enrolled = await mod.isEnrolledAsync();
      if (!hasHardware) {
        setStatus("Pas de matériel biométrique");
        return;
      }
      if (!enrolled) {
        setStatus("Aucun Face ID/Touch ID enregistré");
        return;
      }
      const res = await mod.authenticateAsync({ promptMessage: "Test Face ID" });
      setStatus(res.success ? "Succès biométrique" : res.error || "Échec/annulé");
    } catch (e: any) {
      setStatus(e?.message || "Erreur biométrie");
    }
  }, []);

  return (
    <TouchableOpacity onPress={runTest} style={[styles.bioButton, styles.bioSecondary]}>
      <Text style={styles.bioSecondaryText}>{status ? `Face ID: ${status}` : "Tester Face ID"}</Text>
    </TouchableOpacity>
  );
}

function SignInWithFaceIdDialog(props: any) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AmplifySignIn {...props} />
      <TouchableOpacity style={styles.faceIdTrigger} onPress={() => setOpen(true)}>
        <Text style={styles.faceIdTriggerText}>Tester Face ID</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.faceIdModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.faceIdModalCard}>
                <Text style={styles.faceIdModalTitle}>Test Face ID</Text>
                <Text style={styles.faceIdModalSubtitle}>Lance une authentification pour vérifier le prompt.</Text>
                <FaceIdTestButton />
                <TouchableOpacity style={[styles.bioButton, styles.bioSecondary]} onPress={() => setOpen(false)}>
                  <Text style={styles.bioSecondaryText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

// 🔹 Composant interne : utilise les hooks de contexte DANS les Providers
function AppShell() {
  const { signOut, authStatus } = useAuthenticator((context) => [context.authStatus]);
  const { biometricVerified, biometricError, biometricBusy, requestBiometric } = useBiometric();
  const theme = useTheme();   
  const pathname = usePathname();
  const segments = useSegments() as string[]; 
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Exemple de segments: ['(courier)', 'navigate'] ou ['(receiver)', 'home']
  const isCourier = segments?.includes('(courier)');
  const isLiveNav = pathname?.startsWith("/(courier)/navigate");
  const hideTopBar = pathname?.startsWith("/home/onboarding") || isLiveNav;
  const isProfile = pathname?.startsWith("/profile");

  useEffect(() => {
    if (authStatus === "authenticated" && !biometricVerified) {
      requestBiometric();
    }
  }, [authStatus, biometricVerified, requestBiometric]);

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
            <FaceIdTestButton />
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
            <ModeSwitch
              isCourier={isCourier}
              onToggle={() =>
                router.replace((isCourier ? "/(receiver)/home" : "/(courier)/navigate") as Href)
              }
            />
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
            <AmplifyThemeProvider theme={amplifyAuthTheme} colorMode="dark">
              <BiometricProvider>
                <AuthenticatorBiometricWatcher />
                <Authenticator Container={AuthContainer} components={{ SignIn: SignInWithFaceIdDialog }}>
                  {/* ✅ Tous les hooks de contexte sont appelés dans AppShell */}
                  <AppShell />
                </Authenticator>
              </BiometricProvider>
            </AmplifyThemeProvider>
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
  modeSwitch: {
    width: 78,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: Colors.input,
    padding: 4,
    justifyContent: "center",
  },
  modeThumbWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  modeThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
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
  biometricError: { color: Colors.error, fontWeight: "700" },
  biometricActions: { flexDirection: "row", gap: 12, marginTop: 6 },
  bioButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bioPrimary: { backgroundColor: Colors.accent },
  bioPrimaryText: { color: Colors.background, fontWeight: "800" },
  bioSecondary: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.input },
  bioSecondaryText: { color: Colors.text, fontWeight: "700" },
  faceIdTrigger: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  faceIdTriggerText: {
    color: Colors.accent,
    fontWeight: "700",
  },
  faceIdModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  faceIdModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  faceIdModalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  faceIdModalSubtitle: {
    color: Colors.textSecondary,
  },
});
