# Build APK local pour PayBID
Write-Host "🚀 Build APK local pour PayBID..."

# Configuration pour PayBID
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

# Lancer Expo en mode développement
Write-Host "📱 Lancement Expo Go pour PayBID..."
npx expo start --dev-client --clear

Write-Host ""
Write-Host "📋 Instructions pour build APK PayBID :"
Write-Host "1. Ouvrez Expo Go sur votre téléphone"
Write-Host "2. Scannez le QR code ci-dessus"
Write-Host "3. Dans l'app, appuyez sur '...' → 'Build' → 'Android APK'"
Write-Host "4. L'APK PayBID sera généré et téléchargé"
Write-Host ""
Write-Host "🌐 Alternative web : http://localhost:8081"
