// app.config.js — CommonJS + .env
const dotenv = require("dotenv");
dotenv.config();

/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config, mode }) => {
  const isDev = mode === "development";

  return ({
  ...config,
  expo: {
    name: "convecta",
    slug: "convecta",
    owner: "ready-to-dev",
    version: "1.0.31",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "convecta",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yasi82.convecta",
      buildNumber: "5",
      deploymentTarget: "16.0",
      infoPlist: {
        NSCameraUsageDescription:
          "La caméra est utilisée pour scanner les QR codes et les cartes d'identité.",
        NSLocationWhenInUseUsageDescription:
          "Nous utilisons votre position pour centrer la carte et proposer des livraisons à proximité.",
        NSPhotoLibraryAddUsageDescription:
          "Enregistrer les images scannées pour vérification KYC.",
        NSFaceIDUsageDescription:
          "Face ID est utilisé pour sécuriser la connexion et déverrouiller l'application.",
        LSApplicationQueriesSchemes: ["whatsapp", "whatsapp-business"],
      },
    },

    android: {
      versionCode: 7,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.USE_BIOMETRIC",
      ],
      package: "com.yasi82.convecta",
    },

    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      ["expo-camera"],
      // Only include expo-dev-client in development builds
      ...(isDev ? [["expo-dev-client"]] : []),
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      router: {},
      eas: {
        projectId: "87d19859-6b3f-4665-99fc-e47ffcb8b914",
      },
      EXPO_PUBLIC_MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "",
    },

    runtimeVersion: "1.0.31",
    updates: {
      url: "https://u.expo.dev/87d19859-6b3f-4665-99fc-e47ffcb8b914",
    },
  },
});
};
