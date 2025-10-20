# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install expo
   npx expo install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

3. Run API

   ```bash
   npx ampx sandbox
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


## Issues during build
# 1) from project root
cd /Users/simonyannick/Apps/mobile/convecta

# 2) fix ownership (sudo just for chown, not for pod/npm/expo)
sudo chown -R "$(whoami)" .
sudo chown -R "$(whoami)" ~/.cocoapods ~/Library/Caches/CocoaPods 2>/dev/null || true

# 3) clean & reinstall JS deps (also fixes earlier npm lock mismatch)
rm -rf node_modules package-lock.json
npm install

# 4) clean iOS pods and reinstall
cd ios
rm -rf Pods Podfile.lock
pod repo update
pod install --repo-update
cd ..

# 5) (optional) re-sync native config if needed
npx expo prebuild --platform ios

# 6) run on iOS – NO sudo
npx expo run:ios        # or: npx expo run:ios --device


## Publish app

eas update --branch main
eas build --platform ios
eas submit


## Backend Amplify
push back : sudo npx @aws-amplify/backend-cli sandbox
