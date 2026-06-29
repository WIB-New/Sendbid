# Build et déplacement des APKs vers le bureau
Write-Host "🚀 Build et déplacement des APKs vers le bureau" -ForegroundColor Green

$desktopPath = [Environment]::GetFolderPath("Desktop")
Write-Host "📂 Bureau : $desktopPath" -ForegroundColor Cyan

# Configuration SendBID
Write-Host "📱 Build SendBID..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

# Lancer Expo Go pour build
Write-Host "🔧 Lancement Expo Go pour SendBID..." -ForegroundColor Yellow
Write-Host "Instructions :" -ForegroundColor Cyan
Write-Host "1. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "2. Menu '...' → 'Build' → 'Android APK'" -ForegroundColor White
Write-Host "3. L'APK sera téléchargé sur votre téléphone" -ForegroundColor White
Write-Host "4. Transférez l'APK vers votre bureau" -ForegroundColor White
Write-Host ""

npx expo start --dev-client --clear

Write-Host ""
Write-Host "✅ Une fois SendBID transféré, lancez PayBID :" -ForegroundColor Green
Write-Host ".\build-paybid-and-move.ps1" -ForegroundColor Cyan
