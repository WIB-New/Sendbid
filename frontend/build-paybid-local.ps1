# Build PayBID APK Android local
Write-Host "🚀 Build PayBID APK Android local" -ForegroundColor Green

# Configuration PayBID
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

Write-Host "📱 Configuration PayBID..." -ForegroundColor Yellow
Write-Host "Backend URL: http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io" -ForegroundColor Cyan

# Regénérer le projet Android pour PayBID
Write-Host "🔧 Génération du projet Android PayBID..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean

# Builder l'APK avec Gradle
Write-Host "📦 Build APK PayBID avec Gradle..." -ForegroundColor Yellow
cd android
./gradlew assembleRelease

Write-Host ""
Write-Host "✅ APK PayBID créé dans android/app/build/outputs/apk/release/" -ForegroundColor Green
Write-Host "📂 Fichier : app-release.apk" -ForegroundColor White
