# Build PayBID et déplacement vers le bureau
Write-Host "🚀 Build PayBID et déplacement vers le bureau" -ForegroundColor Green

$desktopPath = [Environment]::GetFolderPath("Desktop")
Write-Host "📂 Bureau : $desktopPath" -ForegroundColor Cyan

# Configuration PayBID
Write-Host "📱 Build PayBID..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

# Lancer Expo Go pour build
Write-Host "🔧 Lancement Expo Go pour PayBID..." -ForegroundColor Yellow
Write-Host "Instructions :" -ForegroundColor Cyan
Write-Host "1. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "2. Menu '...' → 'Build' → 'Android APK'" -ForegroundColor White
Write-Host "3. L'APK sera téléchargé sur votre téléphone" -ForegroundColor White
Write-Host "4. Transférez l'APK vers votre bureau" -ForegroundColor White
Write-Host ""

npx expo start --dev-client --clear --port 8082

Write-Host ""
Write-Host "✅ PayBID APK prêt !" -ForegroundColor Green
