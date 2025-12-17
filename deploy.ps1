# Firebase Deployment Script
# This script builds and deploys the admin panel to Firebase

Write-Host "🚀 Starting deployment process..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Build the client
Write-Host "📦 Building client application..." -ForegroundColor Yellow
cd client
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Please check the errors above." -ForegroundColor Red
    cd ..
    exit 1
}

Write-Host "✅ Build completed successfully!" -ForegroundColor Green
cd ..
Write-Host ""

# Step 2: Deploy to Firebase
Write-Host "🔥 Deploying to Firebase..." -ForegroundColor Yellow

# Try using npx first (works with Node.js v22)
try {
    npx firebase-tools deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
        Write-Host "🌐 Your admin panel is now live!" -ForegroundColor Cyan
        exit 0
    }
} catch {
    Write-Host "⚠️  npx firebase-tools failed, trying global firebase..." -ForegroundColor Yellow
    firebase deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
        Write-Host "🌐 Your admin panel is now live!" -ForegroundColor Cyan
        exit 0
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed!" -ForegroundColor Red
        Write-Host "💡 Try: npm install -g firebase-tools@latest" -ForegroundColor Yellow
        exit 1
    }
}
