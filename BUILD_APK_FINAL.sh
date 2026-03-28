#!/bin/bash
# APK Build Script - Offline-First Fitness App
# Works with Docker or local Android SDK

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Building Offline-First APK..."
echo ""

# Step 1: Build Next.js
echo "📦 Step 1: Building Next.js..."
npm run build
echo "✓ Next.js built"
echo ""

# Step 2: Sync Capacitor
echo "📦 Step 2: Syncing Capacitor..."
npx cap sync android
echo "✓ Capacitor synced"
echo ""

# Step 3: Create Keystore (if not exists)
if [ ! -f "android/sport.keystore" ]; then
    echo "🔑 Creating release keystore..."
    keytool -genkey -v -keystore android/sport.keystore \
      -keyalg RSA -keysize 2048 -validity 36500 \
      -alias sport-key \
      -storepass "SportPass2026!" \
      -keypass "SportKey2026!" \
      -dname "CN=Sport App, O=Sport Fitness, L=Paris, ST=France, C=FR"
    echo "✓ Keystore created"
else
    echo "✓ Keystore already exists"
fi
echo ""

# Step 4: Build APK
echo "📦 Step 3: Building APK with Gradle..."
cd android

# Clean build
./gradlew clean

# Build release APK
./gradlew assembleRelease

# Get APK path
APK="app/build/outputs/apk/release/app-release-unsigned.apk"
if [ -f "$APK" ]; then
    echo "✓ APK built: $APK"
    ls -lh "$APK"
else
    echo "❌ APK build failed"
    exit 1
fi

# Step 5: Sign APK (optional but recommended)
echo ""
echo "🔐 Signing APK..."
UNSIGNED_APK="app/build/outputs/apk/release/app-release-unsigned.apk"
SIGNED_APK="app/build/outputs/apk/release/app-release.apk"

jarsigner -verbose \
    -sigalg SHA256withRSA \
    -digestalg SHA-256 \
    -keystore ../android/sport.keystore \
    -storepass "SportPass2026!" \
    -keypass "SportKey2026!" \
    "$UNSIGNED_APK" \
    sport-key

# Align APK
zipalign -v 4 "$UNSIGNED_APK" "$SIGNED_APK"

cd "$PROJECT_DIR"

echo ""
echo "✅ APK BUILD COMPLETE!"
echo ""
echo "📱 APK Location: android/app/build/outputs/apk/release/app-release.apk"
echo "📊 APK Size: $(ls -lh android/app/build/outputs/apk/release/app-release.apk | awk '{print $5}')"
echo ""
echo "🧪 Next Steps:"
echo "  1. Connect Android device with USB debugging enabled"
echo "  2. Install APK: adb install android/app/build/outputs/apk/release/app-release.apk"
echo "  3. Launch app and test offline functionality"
echo "  4. Verify all features work without internet"
echo ""
echo "📤 For Play Store:"
echo "  - Upload signed APK to Google Play Console"
echo "  - Fill in app details, screenshots, description"
echo "  - Submit for review"
echo ""
