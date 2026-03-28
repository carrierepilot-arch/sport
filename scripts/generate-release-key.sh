#!/bin/bash
# generate-release-key.sh - Generates signing key for Google Play Store

set -e

KEYSTORE_PATH="./sport.keystore"
VALIDITY_DAYS=10950  # ~30 years

echo "🔐 Generating Android Release Key for Google Play Store..."

if [ -f "$KEYSTORE_PATH" ]; then
    echo "⚠️  Keystore already exists at $KEYSTORE_PATH"
    echo "Using existing keystore..."
else
    echo "📝 Creating new keystore..."
    
    # Generate keystore
    keytool -genkey -v \
        -keystore "$KEYSTORE_PATH" \
        -keyalg RSA \
        -keysize 2048 \
        -validity $VALIDITY_DAYS \
        -alias "sport-key" \
        -storepass "$KEYSTORE_PASSWORD" \
        -keypass "$KEY_PASSWORD" \
        -dname "CN=Sport, O=Sport Inc, L=Paris, C=FR"
    
    echo "✓ Keystore created successfully at $KEYSTORE_PATH"
fi

# Display key info
echo ""
echo "📊 Key Information:"
keytool -list -v \
    -keystore "$KEYSTORE_PATH" \
    -storepass "$KEYSTORE_PASSWORD" \
    -alias "sport-key"

echo ""
echo "✓ Ready for release builds!"
echo "⚠️  Keep sport.keystore secret and add it to .gitignore"
