# Build APKs ultra-optimises < 100Mo
Write-Host "🚀 Build APKs ultra-optimises SendBID + PayBID" -ForegroundColor Green

# Configuration optimisee pour taille minimale
$env:EXPO_CONFIG_PATH = "app.config.optimized.js"
$env:EAS_SKIP_AUTO_FINGERPRINT = "1" # Accelerer le build

# URL backend locale (plus fiable)
$backendUrl = "http://192.168.1.100:8000" # A adapter avec votre IP locale

Write-Host "📱 SendBID - APK optimise..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = $backendUrl
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "Backend: $backendUrl" -ForegroundColor Cyan
Write-Host "Taille cible: < 100Mo" -ForegroundColor Cyan

# Build SendBID rapide et optimise
npx eas build --platform android --profile preview --non-interactive

Write-Host ""
Write-Host "📱 PayBID - APK optimise..." -ForegroundColor Yellow  
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

# Build PayBID rapide et optimise
npx eas build --platform android --profile preview --non-interactive

Write-Host ""
Write-Host "✅ APKs optimises termines !" -ForegroundColor Green
Write-Host "📂 Vérifiez: https://expo.dev/projects" -ForegroundColor Cyan
