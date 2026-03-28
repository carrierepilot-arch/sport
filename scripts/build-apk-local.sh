#!/usr/bin/env bash
# build-apk-local.sh - Build APK locally with Docker (no Android SDK needed)

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(cd "$SCRIPT_DIR" && pwd)"
APK_OUTPUT="$PROJECT_DIR/build/app.apk"
DOCKER_IMAGE="circleci/android:api-34"  # Pre-built image with Android SDK

echo "🐳 Building APK with Docker..."

# Create output directory
mkdir -p "$PROJECT_DIR/build"

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Build using Docker
docker run --rm \
    -v "$PROJECT_DIR":/workspace \
    -w /workspace \
    -e CI=true \
    -e ANDROID_SDK_ROOT=/opt/android/sdk \
    "$DOCKER_IMAGE" \
    bash -c "
        set -e
        
        echo '📦 Installing dependencies...'
        npm ci
        
        echo '🔨 Building Next.js...'
        npm run build
        
        echo '🔄 Syncing Capacitor...'
        npx cap sync android
        
        echo '🏗️  Building Android APK...'
        cd android
        ./gradlew assembleRelease
        
        echo '✓ APK built successfully!'
        cp app/build/outputs/apk/release/app-release-unsigned.apk ../build/app-unsigned.apk
    "

echo ""
echo "✓ Build complete!"
echo "📦 APK location: $PROJECT_DIR/build/app-unsigned.apk"
echo ""
echo "⚠️  The APK is unsigned. To sign it:"
echo "  jarsigner -keystore ./sport.keystore -signedjar app-signed.apk app-unsigned.apk sport-key"
echo "  zipalign -v 4 app-signed.apk app-release.apk"
