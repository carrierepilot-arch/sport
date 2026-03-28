# 🔨 Guide de build APK Android natif

Ce guide explique comment créer une véritable APK Android native pour l'application Sport.

## ⚠️ Prérequis

Pour créer une APK native Android, vous devez avoir:

1. **Java Development Kit (JDK) 17+**
   - Télécharger: https://www.oracle.com/java/technologies/downloads/
   - Ou utilisez OpenJDK: `choco install openjdk` (via Chocolatey)

2. **Android SDK**
   - Option A: Installer Android Studio (inclut le SDK)
     - https://developer.android.com/studio
   - Option B: Installer Android Command Line Tools
     - https://developer.android.com/studio#command-line-tools-only
   - Variable d'environnement: `ANDROID_HOME` pointant vers le dossier SDK

3. **Gradle** (généralement inclus dans Android SDK)

4. **Capacitor CLI**
   ```bash
   npm install -g @capacitor/cli
   ```

## 🚀 Étapes de build

### 1. Préparer le projet

```bash
cd C:\Users\Admin\sport

# Build Next.js
npm run build

# Build Capacitor (ajoutera la plateforme Android)
npx cap add android

# Sync les fichiers web
npx cap sync android
```

### 2. Configurer Android

```bash
# Ouvrir Android Studio (GUI)
npx cap open android

# Ou compiler via Gradle (CLI)
cd android
gradlew assembleRelease
cd ..
```

### 3. Signer l'APK

Pour une distribution, vous devez signer l'APK avec une clé:

```bash
# Générer une clé (une seule fois)
keytool -genkey -v -keystore sport.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias sport

# Éditer android/app/build.gradle et ajouter:
signingConfigs {
  release {
    storeFile file("../sport.keystore")
    storePassword "votre_password"
    keyAlias "sport"
    keyPassword "votre_password"
  }
}

buildTypes {
  release {
    signingConfig signingConfigs.release
  }
}
```

### 4. Build et générer l'APK

```bash
cd android
gradlew assembleRelease
cd ..

# L'APK sera à: android/app/build/outputs/apk/release/app-release.apk
```

## 📱 Alternative: PWA (Recommandé pour maintenant)

Si Android SDK n'est pas installé, utilisez la **Progressive Web App (PWA)** qui:

- ✅ S'installe directement depuis le navigateur
- ✅ Fonctionne comme une app native
- ✅ Pas besoin d'Android SDK
- ✅ Mises à jour automatiques
- ✅ Sans appstore

Voir: [PWA_INSTALLATION.md](./PWA_INSTALLATION.md)

## 🔄 Mise à jour de l'APK

Après des modifications du code:

```bash
npm run build
npx cap sync android
# Re-build dans Android Studio ou via Gradle
```

## 📊 Distribution

### Sur Google Play Store
1. Créer un compte développeur Google Play
2. Signer l'APK (voir étape 3)
3. Uploader l'APK signé sur Google Play Console
4. Remplir les infos, screenshots, descriptions
5. Soumettre pour revue (24-48h)

### Directement (APK externe)
1. Générer l'APK signé
2. Partager le fichier .apk
3. Les utilisateurs peuvent l'installer via:
   - ADB: `adb install app-release.apk`
   - Ou transférer sur le téléphone et ouvrir le fichier

### Via services en ligne (EAS)
```bash
npm install -g eas-cli
eas build --platform android
```

## 🛠️ Commandes rapides

```bash
# Ajouter plateforme Android
npx cap add android

# Ouvrir dans Android Studio
npx cap open android

# Accélé sync
npx cap sync android

# Build debug
cd android && gradlew assembleDebug && cd ..

# Build release
cd android && gradlew assembleRelease && cd ..

# Clean build
cd android && gradlew clean && cd ..
```

## 📚 Ressources

- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Android Developer Guide](https://developer.android.com/develop)
- [Google Play Console](https://play.google.com/console)
- [Gradle Build System](https://gradle.org/)

## 💡 Conseils

1. **Testez d'abord sur PWA** - plus rapide et pas de compilation
2. **Testez sur un vrai appareil** - l'émulateur peut avoir des différences
3. **Signez l'APK** avant la distribution
4. **Versionnez les release** dans package.json
5. **Gardez votre keystore en sécurité** - nécessaire pour les updates

---

**Pour l'instant, utilisez la PWA qui est déjà fonctionnelle!**
