export default ({ config }) => ({
  ...config,
  expo: {
    name: "convecta",
    slug: "convecta",
    version: "1.0.16",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "convecta",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yasi82.convecta",
      buildNumber: "4",
      infoPlist: {
        NSCameraUsageDescription:
          "La caméra est utilisée pour scanner les QR codes de livraison.",
        NSLocationWhenInUseUsageDescription:
          "Nous utilisons votre position pour centrer la carte et proposer des livraisons à proximité.",
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      // ✅ Permissions nettoyées : ajoute CAMERA, supprime les doublons
      permissions: [
        "android.permission.CAMERA",
        // garde ces deux permissions audio seulement si ton app en a besoin
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

      // Splash screen
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],

      // ✅ Utilitaires Expo
      "expo-audio",
      "expo-location",
      "expo-asset",

      // ✅ Caméra (remplace l’ancien expo-barcode-scanner)
      ["expo-camera"],

      // ✅ Mapbox avec la nouvelle variable d'env
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          // Remplace l'ancienne MAPBOX_DOWNLOADS_TOKEN dépréciée
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
    },

    runtimeVersion: "1.0.16",
    updates: {
      url: "https://u.expo.dev/87d19859-6b3f-4665-99fc-e47ffcb8b914",
    },
  },
});