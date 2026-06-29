# Build APKs ultra-optimises avec backend en ligne
$env:EXPO_CONFIG_PATH = "app.config.slim.js"
$env:EAS_SKIP_AUTO_FINGERPRINT = "1"

$backendUrl = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"

Write-Host "SendBID APK optimise..." -ForegroundColor Yellow
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = $backendUrl
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

npx eas build --platform android --profile preview --non-interactive

Write-Host "PayBID APK optimise..." -ForegroundColor Yellow
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

npx eas build --platform android --profile preview --non-interactive

Write-Host "APKs optimises termines !" -ForegroundColor Green
