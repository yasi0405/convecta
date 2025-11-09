import { useFonts } from 'expo-font';
import { Link, Stack, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ParcelProvider } from '@/context/ParcelContext';
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react-native";
import { Amplify } from "aws-amplify";

import Colors from "@/theme/Colors";
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

// 🔹 Composant interne : utilise les hooks de contexte DANS les Providers
function AppShell() {
  const { signOut } = useAuthenticator();    
  const theme = useTheme();   
  const pathname = usePathname();
  const segments = useSegments() as string[]; 

  // Exemple de segments: ['(courier)', 'navigate'] ou ['(receiver)', 'home']
  const isCourier = segments?.includes('(courier)');
  const hideTopBar = pathname?.startsWith("/home/onboarding");

  const switchLabel = isCourier ? 'Receveur' : 'Livreur';
  const targetHref = isCourier ? '/(receiver)/home' : '/(courier)/home';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!hideTopBar && (
        <View style={styles.topBar}>
          {/* ✅ Navigation déclarative via Link pour garantir le switch */}
          <Link href={targetHref} asChild>
            <TouchableOpacity style={styles.switchButton}>
              <Text style={styles.switchButtonText}>↔ {switchLabel}</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity style={styles.button} onPress={signOut}>
            <Text style={styles.buttonText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      )}

      <Stack
        screenOptions={{
          headerShown: false,        // on n’affiche aucun header natif
          headerBackVisible: false,  // et donc aucun bouton “back”
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>

      <StatusBar style="auto" />
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
    backgroundColor: '#161D25',
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
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
    borderColor: "#00BFA5",
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  switchButtonText: {
    color: "#00BFA5",
    fontSize: 13,
    fontWeight: "bold",
  },
});
