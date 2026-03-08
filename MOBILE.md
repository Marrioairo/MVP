# HoopsAI Mobile Guide (Capacitor)

HoopsAI can be packaged as a native mobile app using Capacitor.

## PWA Features
HoopsAI is a Progressive Web App. You can install it directly from the browser:
- **Android**: Tap the "Add to Home Screen" prompt.
- **iOS**: Tap the Share button and select "Add to Home Screen".

## Capacitor Setup
To package as a native Android/iOS app:

1. **Install Dependencies**:
   ```bash
   npm install @capacitor/core @capacitor/cli
   ```

2. **Initialize Capacitor**:
   ```bash
   npx cap init HoopsAI com.hoopsai.app
   ```

3. **Build the Web App**:
   ```bash
   npm run build
   ```

4. **Add Platforms**:
   ```bash
   npx cap add android
   npx cap add ios
   ```

5. **Sync Code**:
   ```bash
   npx cap sync
   ```

6. **Open in IDE**:
   ```bash
   npx cap open android
   npx cap open ios
   ```

## Publishing Checklist
- **Android**: Generate a signed AAB/APK in Android Studio.
- **iOS**: Archive and upload to App Store Connect in Xcode.
- **Assets**: Ensure you have icons (1024x1024) and splash screens.
- **Privacy Policy**: Required for both stores.
