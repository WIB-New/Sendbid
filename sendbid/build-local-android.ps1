# Build APK Android local avec Android Studio
Write-Host "🚀 Build APK Android local (sans file d'attente)" -ForegroundColor Green

# Configuration SendBid
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "📱 Configuration SendBID..." -ForegroundColor Yellow
Write-Host "Backend URL: http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io" -ForegroundColor Cyan

# Générer le projet Android
Write-Host "🔧 Génération du projet Android..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean

# Builder l'APK avec Gradle
Write-Host "📦 Build APK avec Gradle..." -ForegroundColor Yellow
cd android
./gradlew assembleRelease

Write-Host ""
Write-Host "✅ APK SendBID créé dans android/app/build/outputs/apk/release/" -ForegroundColor Green
Write-Host "📂 Fichier : app-release.apk" -ForegroundColor White
