#!/usr/bin/env pwsh

# SPORT FITNESS - GITHUB ACTIONS BUILD TRIGGER
# This script configures Git with your token and pushes to GitHub

Write-Host "`n" -ForegroundColor Cyan
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SPORT FITNESS - GITHUB PUSH & AUTO-BUILD SETUP   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Step 1: Check current status
Write-Host "📋 Step 1: Checking current status..." -ForegroundColor Yellow
$currentDir = (Get-Location).Path
if (Test-Path ".git") {
    Write-Host "✅ Git repository found" -ForegroundColor Green
} else {
    Write-Host "❌ Not in a git repository!" -ForegroundColor Red
    exit 1
}

# Step 2: Show current remote
Write-Host "`n📋 Step 2: Current Git configuration..." -ForegroundColor Yellow
git remote -v
$currentRemote = git remote get-url origin
Write-Host "Current remote: $currentRemote" -ForegroundColor Cyan

# Step 3: Show commits ready to push
Write-Host "`n📋 Step 3: Ready to push..." -ForegroundColor Yellow
git log --oneline origin/master..master 2>/dev/null | ForEach-Object { Write-Host "  📤 $_" }
Write-Host ""

# Step 4: Verify tags
Write-Host "📋 Step 4: Release tags..." -ForegroundColor Yellow
$tags = git tag -l
if ($tags) {
    $tags | ForEach-Object { Write-Host "  🏷️  $_" }
} else {
    Write-Host "⚠️  No tags found" -ForegroundColor Yellow
}

Write-Host "`n"
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  READY FOR GITHUB PUSH                             ║" -ForegroundColor Cyan  
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📝 NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣  Create GitHub Token:" -ForegroundColor Cyan
Write-Host "   Visit: https://github.com/settings/tokens/new" -ForegroundColor Green
Write-Host "   - Token name: 'Sport APK Build'" -ForegroundColor Gray
Write-Host "   - Scopes: ✅ repo, ✅ workflow" -ForegroundColor Gray
Write-Host "   - Expiration: 90 days" -ForegroundColor Gray
Write-Host "   - Click 'Generate token' and COPY it" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  Configure Git (when you have token):" -ForegroundColor Cyan
Write-Host "   `$token = 'YOUR_TOKEN_HERE'" -ForegroundColor Green
Write-Host "   git remote set-url origin https://`$token@github.com/carrierepilot/sport.git" -ForegroundColor Green
Write-Host ""

Write-Host "3️⃣  Push to GitHub:" -ForegroundColor Cyan
Write-Host "   git push -u origin master" -ForegroundColor Green
Write-Host "   git push origin v1.0.0" -ForegroundColor Green
Write-Host ""

Write-Host "4️⃣  Monitor Build (requires 'gh' CLI):" -ForegroundColor Cyan
Write-Host "   gh run list" -ForegroundColor Green
Write-Host "   gh run watch" -ForegroundColor Green
Write-Host ""

Write-Host "5️⃣  Download APK when ready:" -ForegroundColor Cyan
Write-Host "   gh release download v1.0.0" -ForegroundColor Green
Write-Host ""

Write-Host "⏱️  Build time: ~5-10 minutes" -ForegroundColor Yellow
Write-Host ""

# Offer to auto-push if user has credentials
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AUTO-PUSH OPTION (If credentials cached)          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "If you have Git credentials cached for GitHub," -ForegroundColor Yellow
Write-Host "you can run:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ./push-to-github.ps1 -AutoPush" -ForegroundColor Green
Write-Host ""
