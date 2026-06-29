# Build direct via navigateur
Write-Host "🚀 Ouverture du build dans votre navigateur..." -ForegroundColor Green

# Configuration
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

# Ouvrir le dashboard Expo directement
Start-Process "https://expo.dev"

Write-Host "📋 Instructions :" -ForegroundColor Cyan
Write-Host "1. Connectez-vous avec wibuser" -ForegroundColor White
Write-Host "2. Cliquez sur 'New Project'" -ForegroundColor White
Write-Host "3. Nom : SENDBID-Wibuser" -ForegroundColor White
Write-Host "4. Slug : sendbid-wibuser-dev" -ForegroundColor White
Write-Host "5. Une fois créé, cliquez sur 'Build'" -ForegroundColor White
Write-Host "6. Choisissez Android APK" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Le dashboard Expo s'ouvre dans votre navigateur" -ForegroundColor Green
