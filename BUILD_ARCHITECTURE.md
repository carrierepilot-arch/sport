# Build architecture for Sport App APK

## Current Setup

```
sport/
├── app/               # Next.js application (web UI)
├── public/           # Static assets (PWA icons, manifest)
├── android/          # Capacitor Android project
├── capacitor.config.ts  # Capacitor configuration
└── package.json
```

## How the APK is built

### 1. **Local Development**
```bash
npm run dev           # Runs Next.js dev server
open http://localhost:3000
```

### 2. **GitHub Actions Build (CI/CD)**
When you push a tag like `v1.0.0`:

```bash
npm run build           # Builds Next.js
  ↓ Creates .next/ folder with compiled app
  
npx cap sync android   # Syncs to android/ project
  ↓ Copies public/ assets
  
cd android
./gradlew assembleRelease  # Builds APK
  ↓ Creates app-release-unsigned.apk
  
jarsigner              # Signs APK with keystore
  ↓ Creates app-release.apk (ready for Play Store)
```

## Files Structure

### A. Web App (Next.js)
- `app/` - React components and pages
- `public/manifest.json` - PWA metadata
- `public/service-worker.js` - Offline support
- `public/icon-*.svg` - App icons

### B. Android (Capacitor)
- `android/app/src/main/AndroidManifest.xml` - App config
- `android/app/build.gradle` - Gradle build config
- `android/gradlew` - Gradle wrapper
- `capacitor.config.ts` - Capacitor settings

### C. CI/CD (GitHub Actions)
- `.github/workflows/android-build.yml` - Automated build/sign

## Key Differences: Web vs APK

| Aspect | PWA | APK |
|--------|-----|-----|
| Store | Browser/direct link | Google Play Store |
| Installation | Add to home screen | Play Store download |
| Size | ~5 MB cache | ~50-100 MB |
| Updates | Auto from server | Manual through Play Store |
| Offline | Service Worker | Service Worker |
| Permissions | Browser | Android manifest |

## The Server URL

In `capacitor.config.ts`:
```typescript
server: {
  url: 'https://sport-alpha-lake.vercel.app'  // Live server
}
```

This means the app **streams the web app from the cloud** rather than bundling all files in APK.

**Advantages:**
- Smaller APK (~10 MB instead of 100 MB)
- Automatic updates
- Same experience as web PWA

**Disadvantages:**
- Requires internet connection for app updates
- Slightly slower first load
- Not fully offline (only cached pages work offline)

## To Make Offline-First APK

To include all static assets in the APK:

1. Build Next.js with `output: 'export'`
2. Copy generated `out/` to `android/app/src/main/assets/public/`
3. Update `capacitor.config.ts`:
```typescript
webDir: 'public'  // Use local files instead
```

This creates a **large APK** (~80-150 MB) but works fully offline.

## Recommendations

### For Play Store
✅ **Use cloud URL (current setup)**
- Lighter APK
- Easier updates
- Better for users

### For Enterprise/Internal
✅ **Use offline APK**
- Full functionality without internet
- No dependency on server
- But larger download

## Build Size Comparison

| Type | Size | Time |
|------|------|------|
| PWA | ~2 MB cache | Instant |
| APK (cloud) | ~10 MB | 5 minutes |
| APK (offline) | ~100 MB | 10 minutes |

---

**Current: Cloud-based APK (recommended for Play Store)**
