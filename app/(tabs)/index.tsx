import Colors from "@/constants/Colors";
import { useAuthenticator } from "@aws-amplify/ui-react-native";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SvgUri } from "react-native-svg";

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuthenticator();

  return (
    <View style={styles.container}>
      <SvgUri
        uri={require("../../assets/images/logo.svg")}
        width={100}
        height={100}
      />
      <Text style={styles.title}>Bienvenue, {user?.attributes?.given_name ?? "utilisateur"} !</Text>
      <TouchableOpacity
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
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: "center",
    marginBottom: 20,
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
});