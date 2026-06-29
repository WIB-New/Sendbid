# Build PayBID APK pour Franck
$env:EXPO_OWNER = "severinfaussi237"
$env:APP_VARIANT = "paybid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "paybid"

Write-Host "🚀 Build PayBID APK pour Franck (owner: severinfaussi237)..."
npx eas build --profile preview-paybid
