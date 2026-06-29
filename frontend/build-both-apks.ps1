# Build automatisé des deux APKs SendBID + PayBID
Write-Host "🚀 Build des deux APKs SendBID + PayBID" -ForegroundColor Green

# Build SendBID
Write-Host "📱 Build SendBID APK..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "Scan QR code SendBID avec Expo Go, puis appuyez sur ENTER pour continuer..." -ForegroundColor Cyan
npx expo start --dev-client --clear

Write-Host ""
Write-Host "📱 Build PayBID APK..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

Write-Host "Scan QR code PayBID avec Expo Go..." -ForegroundColor Cyan
npx expo start --dev-client --clear --port 8082

Write-Host ""
Write-Host "✅ Les deux APKs sont prêts !" -ForegroundColor Green
Write-Host "SendBID : App client (envoi d'argent, enchères)" -ForegroundColor White
Write-Host "PayBID : App agent (retraits, commissions)" -ForegroundColor White
