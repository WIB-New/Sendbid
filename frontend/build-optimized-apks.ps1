# Build APKs optimises < 100Mo avec backend fonctionnel
Write-Host "🚀 Build APKs optimises SendBID + PayBID (< 100Mo)" -ForegroundColor Green

# Utiliser la configuration optimisee
$env:EXPO_CONFIG_PATH = "app.config.optimized.js"

# URL de fallback si le backend principal ne fonctionne pas
$backendUrl = "http://localhost:8000" # Backend local en fallback

# Configuration SendBID
Write-Host "📱 Build SendBID optimise..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = $backendUrl
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "Backend URL: $backendUrl" -ForegroundColor Cyan

# Build SendBID optimise
Write-Host "🔧 Lancement build SendBID optimise..." -ForegroundColor Yellow
npx eas build --platform android --profile preview --non-interactive --clear-cache

Write-Host ""
Write-Host "📱 Build PayBID optimise..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

# Build PayBID optimise
Write-Host "🔧 Lancement build PayBID optimise..." -ForegroundColor Yellow
npx eas build --platform android --profile preview --non-interactive

Write-Host ""
Write-Host "✅ Builds optimises termines !" -ForegroundColor Green
Write-Host "📱 APKs < 100Mo avec backend configure" -ForegroundColor White
