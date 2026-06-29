# Deplacer les APKs vers le bureau
$desktopPath = [Environment]::GetFolderPath("Desktop")
$apkFolder = "$desktopPath\SendBID-APKs"

Write-Host "Dossier APKs: $apkFolder"

# Configuration SendBID
$env:APP_VARIANT = "sendbid"
$env:EXPO_PUBLIC_BACKEND_URL = "http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io"
$env:EXPO_PUBLIC_APP_VARIANT = "sendbid"

Write-Host "Lancement SendBID..."
npx expo start --dev-client --clear
