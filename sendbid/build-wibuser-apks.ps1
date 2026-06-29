# Build APKs sur le compte wibuser
Write-Host "🚀 Build APKs sur votre compte wibuser" -ForegroundColor Green

# Utiliser la configuration wibuser
$env:EXPO_CONFIG_PATH = "app.config.wibuser.js"

# Build SendBID
Write-Host "📱 Build SendBID APK..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

npx expo start --dev-client --clear

Write-Host ""
Write-Host "✅ SendBID prêt ! Maintenant lancez PayBID avec :" -ForegroundColor Green
Write-Host ".\build-paybid-wibuser.ps1" -ForegroundColor Cyan
