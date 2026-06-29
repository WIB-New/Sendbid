# Build PayBID APK sur le compte wibuser
Write-Host "🚀 Build PayBID APK sur votre compte wibuser" -ForegroundColor Green

# Utiliser la configuration wibuser
$env:EXPO_CONFIG_PATH = "app.config.wibuser.js"

# Build PayBID
Write-Host "📱 Build PayBID APK..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

npx expo start --dev-client --clear --port 8082

Write-Host ""
Write-Host "✅ PayBID prêt !" -ForegroundColor Green
