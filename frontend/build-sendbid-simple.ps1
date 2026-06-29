# Build SendBID APK simple
$env:EXPO_CONFIG_PATH = "app.config.wibuser.js"
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "Build SendBID APK..."
npx expo start --dev-client --clear
