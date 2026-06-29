# Génération directe des APKs sans QR code
Write-Host "🚀 Génération directe des APKs SendBID + PayBID" -ForegroundColor Green

$desktopPath = [Environment]::GetFolderPath("Desktop")
$apkFolder = "$desktopPath\SendBID-APKs"

Write-Host "📂 Dossier cible: $apkFolder" -ForegroundColor Cyan

# Configuration SendBID
Write-Host "📱 Génération SendBID APK..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

# Utiliser EAS build avec le projet existant
Write-Host "🔧 Lancement build EAS SendBID..." -ForegroundColor Yellow
try {
    npx eas build --platform android --profile preview --non-interactive
    Write-Host "✅ Build SendBID lancé avec succès!" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erreur SendBID: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "📱 Génération PayBID APK..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

# Build PayBID
Write-Host "🔧 Lancement build EAS PayBID..." -ForegroundColor Yellow
try {
    npx eas build --platform android --profile preview --non-interactive
    Write-Host "✅ Build PayBID lancé avec succès!" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erreur PayBID: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🌐 Vérifiez vos builds sur: https://expo.dev/projects" -ForegroundColor Green
Write-Host "📱 Les APKs apparaîtront dans l'onglet 'Builds'" -ForegroundColor Green
