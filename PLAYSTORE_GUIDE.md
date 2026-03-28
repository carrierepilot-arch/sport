# 📦 Guide Complet: Publier sur Google Play Store

## Phase 1: Préparation de la clé de signature

### Étape 1: Générer la clé de signature (une seule fois)

```bash
# Sur votre machine locale (ou n'importe quel PC)
keytool -genkey -v -keystore sport.keystore -keyalg RSA -keysize 2048 -validity 10950 -alias sport-key
```

Répondre aux prompts:
```
Enter keystore password: [votre_mot_de_passe_1]
Re-enter new password: [votre_mot_de_passe_1]
What is your first and last name? [Sport User]
What is the name of your organizational unit? [Sport Inc]
What is the name of your organization? [Sport Inc]
What is the name of your City or Locality? [Paris]
What is the name of your State or Province? [Ile-de-France]
What is the two-letter country code for this location? [FR]
Is CN=Sport User, OU=Sport Inc, O=Sport Inc, L=Paris, ST=Ile-de-France, C=FR correct? [yes]

Enter key password for <sport-key> (RETURN if same as keystore password): [votre_mot_de_passe_2]
Re-enter new password: [votre_mot_de_passe_2]
```

### Étape 2: Convertir la clé en Base64 pour GitHub Secrets

```bash
# Convertir la clé en base64
base64 sport.keystore > keystore-base64.txt

# Sur Windows (PowerShell):
$content = [System.IO.File]::ReadAllBytes('sport.keystore')
$base64 = [Convert]::ToBase64String($content)
Set-Clipboard -Value $base64
# La clé est maintenant dans le presse-papiers!
```

### Étape 3: Ajouter les secrets GitHub

1. Allez sur: **GitHub → Settings → Secrets and variables → Actions**
2. Cliquez **New repository secret** et ajoutez:

```
Secret name: KEYSTORE_BASE64
Value: [Coller le contenu de keystore-base64.txt ou le contenu du presse-papiers]

Secret name: KEYSTORE_PASSWORD
Value: [votre_mot_de_passe_1]

Secret name: KEY_PASSWORD
Value: [votre_mot_de_passe_2]
```

⚠️ **Sécurité:** Supprimez `sport.keystore` et `keystore-base64.txt` de votre machine après (gardez-les en sécurité ailleurs)

---

## Phase 2: Déclencher la build APK

### Option A: Via Tags Git (Recommandé)

```bash
# Créer un tag de version
git tag v1.0.0
git push origin v1.0.0

# La build se déclenche automatiquement!
```

### Option B: Manuel depuis GitHub UI

1. Allez sur votre repo: **GitHub → Actions**
2. Cliquez sur **Build Android APK for Google Play**
3. Cliquez **Run workflow** → **Run workflow**

### Option C: Depuis votre terminal

```bash
# Via GitHub CLI (si installé)
gh workflow run android-build.yml
```

---

## Phase 3: Télécharger l'APK

1. Allez sur **GitHub → Actions**
2. Cliquez sur le workflow qui vient de s'exécuter
3. Téléchargez l'artifact **app-release.apk**

Ou si vous avez poussé un tag, allez sur **Releases** et téléchargez depuis la release.

---

## Phase 4: Publier sur Google Play Store

### 1. Créer un compte Google Play Studio

- Allez sur: https://play.google.com/console
- Créez un account développeur (frais uniques de $25 USD)
- Remplissez votre profil

### 2. Créer une nouvelle application

1. Cliquez **Create app**
2. Remplissez:
   - **App name**: Sport
   - **Default language**: Français
   - **App type**: Application
   - **Category**: Sports
   - Acceptez les conditions

### 3. Remplir les pages obligatoires

Dans **Product details**:
- ✓ Short description (80 chars max)
- ✓ Full description
- ✓ Screenshots (minimum 2, maximum 8)
- ✓ Feature graphic (1024x500)
- ✓ Icon (512x512)
- ✓ Catégorie
- ✓ Contenu adapté aux enfants

### 4. Uploader l'APK signé

1. Allez dans **Release → Production**
2. Cliquez **Create new release**
3. Sous **APKs and bundles**:
   - Cliquez **Upload**
   - Sélectionnez l'APK: `app-release.apk`

### 5. Remplir les notes de release

```
Version: 1.0.0

Nouveautés:
- Plateforme de fitness sociale complète
- Mini-jeux interactifs
- Suivi des entraînements
- Feed social et notifications
- Mode hors ligne
```

### 6. Préparer le contenu pour l'app

**Pricing & distribution:**
- Free
- Sélectionnez les pays de distribution
- Acceptez les conditions

### 7. Submitter pour revue

1. Allez dans **Release overview**
2. Cliquez **Review release**
3. Révisez tous les détails
4. Cliquez **Submit**

⏳ **Attentez 24-48h pour la revue**

---

## 🔄 Mises à jour futures

Pour publier une mise à jour:

```bash
# 1. Augmentez la version dans package.json
# "version": "1.0.1"

# 2. Committez et créez un tag
git add package.json
git commit -m "v1.0.1: Bug fixes and improvements"
git tag v1.0.1
git push origin main
git push origin v1.0.1

# 3. La build se déclenche automatiquement!

# 4. Quand elle est prête, allez sur Play Console:
#    Release → Production → Create new release
#    Uploadez la nouvelle APK
#    Submetter pour revue
```

---

## 🐛 Dépannage

### L'APK n'est pas signé correctement
```bash
# Vérifiez la signature
jarsigner -verify -verbose app-release.apk
```

### Build échoue sur GitHub
- Vérifiez les secrets sont bien définis
- Vérifiez que le Base64 de la clé est complet (pas coupé)
- Vérifiez que les mots de passe sont corrects

### Play Store refuse l'APK
- Vérifiez l'applicationId dans build.gradle (doit être unique)
- Vérifiez la version versionCode (doit être > à la version précédente)
- Vérifiez que le contenu respecte les politiques Play Store

---

## 📋 Checklist avant publication

- [ ] APK signé et fonctionnel
- [ ] Tests sur vrai appareil Android
- [ ] Icônes haute résolution (512x512 minimum)
- [ ] Screenshots en 4-6 langues (ou au minimum anglais)
- [ ] Description claire et attrayante
- [ ] Politique de confidentialité complète
- [ ] Permissions justifiées (caméra, micro, etc.)
- [ ] Pas de contenu interdit (armes, drogues, etc.)
- [ ] Contenu adapté aux enfants (si app enfants)

---

## 📚 Ressources

- [Google Play Console](https://play.google.com/console)
- [App policies](https://play.google.com/about/developer-content-policy/)
- [Android best practices](https://developer.android.com/distribute)
- [Capacitor Android docs](https://capacitorjs.com/docs/android)

---

**Bonne chance pour votre publication! 🚀**
