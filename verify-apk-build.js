#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('\n🔍 SPORT FITNESS APK - FINAL VERIFICATION CHECKLIST\n');
console.log('=' .repeat(60));

const checks = [
  {
    name: 'Next.js Build',
    files: ['.next/.build-id', '.next/server', '.next/static'],
    critical: true
  },
  {
    name: 'Public Assets',
    files: ['public/index.html', 'public/manifest.json', 'public/service-worker.js'],
    critical: true
  },
  {
    name: 'Capacitor Android',
    files: ['android/app/src/main/assets/public/index.html', 'android/capacitor.settings.gradle'],
    critical: true
  },
  {
    name: 'Offline Database',
    files: ['lib/offlineDB.ts'],
    critical: true
  },
  {
    name: 'Network Detection',
    files: ['app/hooks/useNetworkStatus.ts'],
    critical: true
  },
  {
    name: 'Configuration Files',
    files: ['capacitor.config.ts', 'next.config.ts', 'tsconfig.json'],
    critical: true
  },
  {
    name: 'GitHub Actions CI/CD',
    files: ['.github/workflows/android-build.yml'],
    critical: true
  },
  {
    name: 'Documentation',
    files: ['OFFLINE_FIRST.md', 'BUILD_ARCHITECTURE.md', 'PLAYSTORE_GUIDE.md', 'APK_FINALIZATION_GUIDE.md'],
    critical: false
  },
  {
    name: 'Build Scripts',
    files: ['BUILD_APK_FINAL.sh', 'scripts/build-offline-apk.sh'],
    critical: false
  }
];

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = [];

checks.forEach(category => {
  console.log(`\n${category.critical ? '🔴' : '🟡'} ${category.name}`);
  console.log('-' .repeat(40));

  let categoryPassed = 0;
  const categoryTotal = category.files.length;

  category.files.forEach(file => {
    totalChecks++;
    const filePath = path.join(process.cwd(), file);
    const exists = fs.existsSync(filePath);

    if (exists) {
      passedChecks++;
      categoryPassed++;
      
      try {
        const stats = fs.statSync(filePath);
        const size = stats.isFile() ? `(${(stats.size / 1024).toFixed(2)}KB)` : '(dir)';
        console.log(`  ✅ ${file} ${size}`);
      } catch (e) {
        console.log(`  ✅ ${file}`);
      }
    } else {
      failedChecks.push({ category: category.name, file, critical: category.critical });
      console.log(`  ❌ ${file} - NOT FOUND`);
    }
  });

  console.log(`  → ${categoryPassed}/${categoryTotal} files present`);
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 VERIFICATION RESULTS:`);
console.log(`  Total Checks: ${totalChecks}`);
console.log(`  ✅ Passed: ${passedChecks}`);
console.log(`  ❌ Failed: ${totalChecks - passedChecks}`);

if (failedChecks.length > 0) {
  console.log(`\n⚠️  MISSING FILES:`);
  failedChecks.forEach(fail => {
    const icon = fail.critical ? '🔴' : '🟡';
    console.log(`  ${icon} [${fail.category}] ${fail.file}`);
  });

  const criticalFails = failedChecks.filter(f => f.critical);
  if (criticalFails.length > 0) {
    console.log(`\n❌ CRITICAL FILES MISSING - CANNOT BUILD APK`);
    process.exit(1);
  } else {
    console.log(`\n⚠️  Non-critical files missing. Build will work but with reduced functionality.`);
  }
} else {
  console.log(`\n✅ ALL FILES PRESENT - READY TO BUILD!`);
}

// Asset count
console.log(`\n📦 EMBEDDED ASSETS:`);
try {
  const assetsDir = path.join(process.cwd(), 'android/app/src/main/assets/public');
  if (fs.existsSync(assetsDir)) {
    const countFiles = (dir) => {
      let count = 0;
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) count++;
        else if (stat.isDirectory()) count += countFiles(filePath);
      });
      return count;
    };
    const assetCount = countFiles(assetsDir);
    console.log(`  📁 ${assetCount} files embedded in APK`);
  }
} catch (e) {
  console.log(`  ⚠️  Could not count embedded assets`);
}

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log(`\n🎯 STATUS: ${passedChecks === totalChecks ? '✅ READY TO BUILD' : '⚠️  REVIEW NEEDED'}\n`);

// Build instructions
if (passedChecks === totalChecks) {
  console.log(`📖 NEXT STEPS:\n`);
  console.log(`   Option 1 (Local with SDK):`);
  console.log(`     cd android && ./gradlew assembleRelease\n`);
  console.log(`   Option 2 (Docker):`);
  console.log(`     docker build -f Dockerfile.android -t sport-apk . && docker run --rm sport-apk\n`);
  console.log(`   Option 3 (GitHub Actions):`);
  console.log(`     git push origin master && git push origin v1.0.0\n`);
}
