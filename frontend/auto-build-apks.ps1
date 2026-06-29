# Build automatique des APKs sur le compte wibuser
Write-Host "🚀 Build automatique des APKs SendBID + PayBID" -ForegroundColor Green

# Se connecter et créer un nouveau projet
Write-Host "📱 Connexion au compte wibuser..." -ForegroundColor Yellow

# Configuration SendBID
Write-Host "🔧 Configuration SendBID..." -ForegroundColor Cyan
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

# Créer un nouveau projet et build SendBID
Write-Host "📦 Création et build SendBID..." -ForegroundColor Yellow
try {
    npx eas build --platform android --profile preview --non-interactive --clear-cache
    Write-Host "✅ Build SendBID lancé avec succès !" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erreur SendBID, tentative avec nouvelle configuration..." -ForegroundColor Yellow
    # Backup configuration
    Copy-Item "app.config.temp.js" "app.config.js" -Force
    npx eas build --platform android --profile preview --non-interactive
}

Write-Host ""
Write-Host "📱 Configuration PayBID..." -ForegroundColor Cyan
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

# Build PayBID
Write-Host "📦 Build PayBID..." -ForegroundColor Yellow
try {
    npx eas build --platform android --profile preview --non-interactive
    Write-Host "✅ Build PayBID lancé avec succès !" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du build PayBID" -ForegroundColor Red
}

Write-Host ""
Write-Host "🌐 Vérifiez vos builds sur : https://expo.dev/projects" -ForegroundColor Green
Write-Host "📱 Les APKs apparaîtront dans l'onglet 'Builds'" -ForegroundColor Green
