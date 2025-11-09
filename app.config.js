// app.config.js — CommonJS + .env
const dotenv = require("dotenv");
dotenv.config();

/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  expo: {
    name: "convecta",
    slug: "convecta",
    version: "1.0.17",
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
        LSApplicationQueriesSchemes: ["whatsapp", "whatsapp-business"],
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
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

    runtimeVersion: "1.0.17",
    updates: {
      url: "https://u.expo.dev/87d19859-6b3f-4665-99fc-e47ffcb8b914",
    },
  },
});
