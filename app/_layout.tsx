import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ParcelProvider } from '@/src/context/ParcelContext';

import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react-native";
import { Amplify } from "aws-amplify";

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { Button, StyleSheet, View } from 'react-native';
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

  return (
    <ParcelProvider>
      <ThemeProvider>
        <Authenticator.Provider>
          <Authenticator>
            <SignOutButton />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </Authenticator>
        </Authenticator.Provider>
      </ThemeProvider>
    </ParcelProvider>
  );
}

const styles = StyleSheet.create({
  signOutButton: {
    alignSelf: "flex-end",
  },
});
