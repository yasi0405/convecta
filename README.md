# Convecta Mobile

Convecta is the Expo + React Native mobile app that powers the Receiver and Courier journeys for parcel management (tracking, intake, slots, QR confirmations, and more). This repo hosts the frontend app, Amplify orchestration, and the scripts required for day-to-day deliveries as well as EAS builds.

## Table of Contents

1. [Stack & Architecture](#stack--architecture)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Running the Environments](#running-the-environments)
5. [Useful npm Scripts](#useful-npm-scripts)
6. [Project Structure](#project-structure)
7. [Build & Release](#build--release)
8. [iOS Troubleshooting](#ios-troubleshooting)
9. [Resources](#resources)

## Stack & Architecture

- **Frontend**: Expo Router + React Native 0.79, TypeScript 5.8, layout-based navigation (see `app/(receiver)` and `app/(courier)`).
- **Backend**: AWS Amplify (declarative modules under `amplify/` and `amplify/data/`), synced through `ampx sandbox`.
- **Maps & Geolocation**: Mapbox (`@rnmapbox/maps`, `@mapbox/mapbox-gl-geocoder`) for address autocomplete and map rendering.
- **EAS**: OTA updates (`eas update`) and store builds (`eas build`, `eas submit`).

## Prerequisites

- Node.js 18+ (ideally via `nvm`), npm 10+.
- Expo CLI (`npx expo`) and EAS CLI (`npm i -g eas-cli` if needed).
- Xcode + Cocoapods (for iOS) / Android Studio (for Android).
- AWS access (Amplify profiles & permissions). Configure your credentials (`aws configure sso` or `aws configure`) before launching the backend.

## Installation

```bash
git clone <repo>
cd convecta
npm install
```

When upgrading native modules or switching machines, plan for a full cleanup (see [iOS Troubleshooting](#ios-troubleshooting)).

## Running the Environments

### 1. Amplify backend (local sandbox)

```bash
npx ampx sandbox          # or: sudo npx @aws-amplify/backend-cli sandbox
```

This spins up or refreshes isolated backend resources. The first run will prompt you for the region and AWS profile. Keep the process running during development.

### 2. Expo app (dev client, simulators, Expo Go)

```bash
npx expo start            # Metro dashboard + QR code
npx expo run:ios          # local iOS build (avoid sudo)
npx expo run:android      # local Android build
```

- From Metro, pick the desired target (Expo Go, iOS simulator, Android emulator, development build).
- Key entry points: `app/(receiver)/home/index.tsx`, `app/(courier)/home.tsx`, and hooks under `src/features/**`.

## Useful npm Scripts

| Script | Description |
| ------ | ----------- |
| `npm start` | Starts Metro + Expo Router. |
| `npm run ios` / `npm run android` | Native builds via Expo Run. |
| `npm run web` | Expo in web mode (handy for quick checks). |
| `npm run lint` | Expo/ESLint linting. |
| `npm run build:prod` | `expo prebuild` + `eas update --branch main`. |
| `npm run reset-project` | Replaces the app with a blank skeleton (use carefully). |

## Project Structure

```
app/                     # Expo Router navigation (receiver/courier layouts, onboarding, etc.)
src/features/receiver    # Receiver journey (home, pending, incoming, hooks, services)
src/features/courier     # Courier journey (home, pending, summary)
src/lib/amplify.ts       # Client-side Amplify initialization
amplify/                 # Infra & data (GraphQL, auth, storage)
assets/                  # Fonts, images, splash art
scripts/                 # Automations (reset-project, netrc, etc.)
```

> Tip: shared constants live in `src/constants/index.ts`, and API calls live in `src/features/**/services`.

## Build & Release

1. **OTA update** (main branch):

   ```bash
   eas update --branch main
   ```

2. **Store builds**:

   ```bash
   eas build --platform ios
   eas build --platform android
   ```

3. **Submission**:

   ```bash
   eas submit --platform ios --path <.ipa>
   eas submit --platform android --path <.aab>
   ```

Make sure the targeted backend (sandbox vs prod) matches the EAS environment. Check `app.config.js` and the `EXPO_PUBLIC_*` variables whenever you add new secrets.

## iOS Troubleshooting

1. From the project root:

   ```bash
   sudo chown -R "$(whoami)" .
   sudo chown -R "$(whoami)" ~/.cocoapods ~/Library/Caches/CocoaPods 2>/dev/null || true
   ```

2. Reinstall JavaScript dependencies:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Clean Pods:

   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod repo update
   pod install --repo-update
   cd ..
   ```

4. (Optional) Resync native config:

   ```bash
   npx expo prebuild --platform ios
   ```

5. Relaunch:

   ```bash
   npx expo run:ios       # --device for a physical device
   ```

## Resources

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [AWS Amplify (React Native)](https://docs.amplify.aws/react-native/start/)
- [EAS Update & Build](https://docs.expo.dev/eas/)

For product or infrastructure questions, open a Notion/Jira ticket and specify the context (Receiver/Courier, sandbox vs prod backend, Amplify logs).
