# Build APKs corrigés (Network Error + variantes)
$env:EXPO_CONFIG_PATH = "app.config.fixed.js"
$env:EAS_SKIP_AUTO_FINGERPRINT = "1"

Write-Host "SendBID APK corrigé..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

npx eas build --platform android --profile preview --non-interactive

Write-Host "PayBID APK corrigé..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

npx eas build --platform android --profile preview --non-interactive

Write-Host "APKs corrigés terminés !" -ForegroundColor Green
