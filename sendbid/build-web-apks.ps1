# Build APKs via web pour téléchargement direct
Write-Host "🚀 Build APKs via web pour téléchargement direct" -ForegroundColor Green

# Configuration SendBID
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "📱 Lancement build SendBID web..." -ForegroundColor Yellow
Write-Host "📋 Instructions :" -ForegroundColor Cyan
Write-Host "1. Le build va démarrer dans votre navigateur" -ForegroundColor White
Write-Host "2. Connectez-vous avec votre compte wibuser" -ForegroundColor White
Write-Host "3. L'APK sera généré et disponible au téléchargement" -ForegroundColor White
Write-Host ""

npx eas build --platform android --profile preview-sendbid --non-interactive
