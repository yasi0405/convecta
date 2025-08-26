import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ParcelProvider } from '@/src/context/ParcelContext';

import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react-native";
import { Amplify } from "aws-amplify";

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { Button, StyleSheet, Text, View } from 'react-native';
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);


export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  const SignOutButton = () => {
    const { signOut } = useAuthenticator();
    return (
      <View style={styles.signOutButton}>
        <Button title="Sign Out" onPress={signOut} />
      </View>
    );
  };

  const UserInfo = () => {
    const { user } = useAuthenticator();

    if (!user) return null;

    const username = user?.username ?? 'N/A';

    return (
      <View style={styles.userInfoContainer}>
        <Text style={styles.userInfoText}>👤 Utilisateur : {username}</Text>
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <ParcelProvider>
        <ThemeProvider>
          <Authenticator.Provider>
            <Authenticator>
              <SafeAreaView style={styles.container} edges={['top']}>
                <SignOutButton />
                <UserInfo />
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style="auto" />
              </SafeAreaView>
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
    backgroundColor: 'white',
  },
  signOutButton: {
    alignSelf: "flex-end",
  },
  userInfoContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  userInfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
});
