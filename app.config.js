export default ({ config }) => ({
  ...config,
  expo: {
    name: "convecta",
    slug: "convecta",
    version: "1.0.10",
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
        NSLocationWhenInUseUsageDescription: "Nous utilisons votre position pour centrer la carte et proposer des livraisons à proximité.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
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
      "expo-audio",
      "expo-location",
      "expo-asset",
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN,
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
    runtimeVersion: "1.0.10",
    updates: {
      url: "https://u.expo.dev/87d19859-6b3f-4665-99fc-e47ffcb8b914",
    },
  },
});