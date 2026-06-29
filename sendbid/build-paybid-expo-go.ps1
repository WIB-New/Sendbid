# Build PayBID APK via Expo Go
Write-Host "🚀 Build PayBID APK via Expo Go" -ForegroundColor Green

# Configuration PayBID
Write-Host "📱 Configuration PayBID..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

Write-Host "Backend URL: http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io" -ForegroundColor Cyan

# Lancer Expo Go pour build APK
Write-Host "📱 Lancement Expo Go pour build PayBID APK..." -ForegroundColor Yellow
Write-Host "Instructions :" -ForegroundColor Cyan
Write-Host "1. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "2. Dans l'app, appuyez sur '...' → 'Build' → 'Android APK'" -ForegroundColor White
Write-Host "3. L'APK PayBID sera généré et téléchargé" -ForegroundColor White
Write-Host ""

npx expo start --dev-client --clear --port 8082

Write-Host ""
Write-Host "✅ PayBID APK prêt !" -ForegroundColor Green
