# 📲 Sport App - 3 Façons de Publier sur Google Play Store

## ✨ Résumé Rapide

| Méthode | Effort | Temps | Coût | Qualité |
|---------|--------|-------|------|---------|
| **1. GitHub Actions (Cloud)** 🚀 | Minimal | 5 min | 0€ | Excellent |
| **2. Docker Local** | Faible | 30 min | 0€ | Excellent |
| **3. Android Studio Local** | Haut | 2 heures | 0€ | Excellent |

---

## 🚀 Option 1: GitHub Actions (RECOMMANDÉ - Plus facile!)

**Temps total: 10 minutes**

### Étapes:

1. **Générer la clé de signature** (une seule fois)
   ```bash
   keytool -genkey -v -keystore sport.keystore -keyalg RSA -keysize 2048 -validity 10950 -alias sport-key
   ```

2. **Ajouter les secrets GitHub**
   - Settings → Secrets → Ajouter `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`
   - [Voir guide complet](./PLAYSTORE_GUIDE.md)

3. **Déclencher la build**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Télécharger l'APK**
   - GitHub → Actions → Cliquez sur le workflow
   - Téléchargez l'artifact `app-release.apk`

5. **Uploader à Play Store**
   - Allez sur https://play.google.com/console
   - Release → Production → Upload APK
   - Submetter pour revue

✅ **Avantages:**
- Pas besoin d'Android SDK
- Build automatique à chaque push/tag
- Sécurisé (clés dans GitHub Secrets)
- Fonctionne sur N'importe quel PC

---

## 🐳 Option 2: Docker (Bon compromis)

**Temps total: 45 minutes**

### Prérequis:
- Docker Desktop installé
- ~10 GB d'espace disque

### Étapes:

```bash
# Installer Docker si pas déjà fait
# https://www.docker.com/products/docker-desktop

# Builder l'APK dans Docker
bash scripts/build-apk-local.sh

# Ou manuellement:
docker build -f Dockerfile.android -t sport-build .
docker run -v $(pwd):/workspace sport-build
```

✅ **Avantages:**
- Sûr (isolé dans container)
- Fonctionne multiplateforme
- Pas d'Android SDK à installer

❌ **Inconvénients:**
- Docker doit être installé
- Plus lent que local
- Télécharge ~5-10 GB d'image

---

## 💻 Option 3: Android Studio Local

**Temps total: 2+ heures**

### Prérequis (à installer):
1. Java JDK 17: https://www.oracle.com/java/technologies/downloads/
2. Android Studio: https://developer.android.com/studio
3. Android SDK API 34

### Étapes:

```bash
npm run build
npx cap sync android
npx cap open android

# Ou sans GUI:
cd android
./gradlew assembleRelease
```

✅ **Avantages:**
- Plus rapide une fois installé
- Meilleur debugging

❌ **Inconvénients:**
- Installation complexe et longue
- ~20 GB d'espace disque
- Configuration difficile

---

## 🎯 Recommandation

**Utilisez GitHub Actions!** C'est:
- ✓ Plus facile
- ✓ Plus sûr
- ✓ Automatique
- ✓ Sans installation locale

[Suivez le guide complet →](./PLAYSTORE_GUIDE.md)

---

## 📦 Fichiers à consulter

- **[PLAYSTORE_GUIDE.md](./PLAYSTORE_GUIDE.md)** - Guide détaillé step-by-step
- **[.github/workflows/android-build.yml](./.github/workflows/android-build.yml)** - Config CI/CD
- **[APK_BUILD_GUIDE.md](./APK_BUILD_GUIDE.md)** - Info technique sur Capacitor
- **[scripts/build-apk-local.sh](./scripts/build-apk-local.sh)** - Script Docker

---

## ❓ FAQ

**Combien ça coûte de publier sur Play Store?**
- Compte développeur: $25 USD (une fois)
- App gratuite: 0€
- App payante: 15-70% de commission

**Qui verra mon APK?**
- Personnes dans les countries sélectionnées
- Personnes avec appareils compatibles (Android 6+)
- Après approbation de Google (24-48h)

**Puis-je publier rapidement?**
- Oui! Avec GitHub Actions, 10 minutes top pour builder
- Mais Google prend 24-48h pour approuver

**Comment faire des mises à jour?**
- Augmentez version dans `package.json`
- Créez un tag: `git tag v1.0.1`
- GitHub Actions rebuild automatiquement
- Uploadez le nouvel APK à Play Store

---

**Prêt? [Commencez par le guide complet! →](./PLAYSTORE_GUIDE.md)**
