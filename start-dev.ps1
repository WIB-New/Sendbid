# Script de démarrage pour SendBID en développement
Write-Host "🚀 Démarrage de SendBID..."

# Démarrer le backend
Write-Host "📦 Démarrage du backend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"

# Attendre un peu que le backend démarre
Start-Sleep -Seconds 3

# Démarrer le frontend
Write-Host "🌐 Démarrage du frontend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npx expo start --web"

Write-Host "✅ Services en cours de démarrage..."
Write-Host "📍 Backend: http://localhost:8000"
Write-Host "📍 Frontend: http://localhost:8081 (ou via Expo)"
Write-Host "📚 API Docs: http://localhost:8000/docs"
