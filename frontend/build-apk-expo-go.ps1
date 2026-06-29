# Build APK via Expo Go (solution finale)
Write-Host "🚀 Build APK via Expo Go (compatible avec votre Java)" -ForegroundColor Green

# Configuration SendBID
Write-Host "📱 Configuration SendBID..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "Backend URL: http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io" -ForegroundColor Cyan

# Lancer Expo Go pour build APK
Write-Host "📱 Lancement Expo Go pour build APK..." -ForegroundColor Yellow
Write-Host "Instructions :" -ForegroundColor Cyan
Write-Host "1. Le QR code va apparaître" -ForegroundColor White
Write-Host "2. Scannez avec Expo Go sur votre téléphone" -ForegroundColor White
Write-Host "3. Dans l'app, appuyez sur '...' → 'Build' → 'Android APK'" -ForegroundColor White
Write-Host "4. L'APK sera généré et téléchargé sur votre téléphone" -ForegroundColor White
Write-Host ""

npx expo start --dev-client --clear

Write-Host ""
Write-Host "✅ Une fois SendBID terminé, lancez PayBID avec :" -ForegroundColor Green
Write-Host ".\build-paybid-expo-go.ps1" -ForegroundColor Cyan
