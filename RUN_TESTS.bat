@echo off
echo ========================================
echo Story Lens - Login Integration Tests
echo Task: P1-S1-T2
echo ========================================
echo.

cd frontend

echo [1/4] Checking environment...
node --version
npm --version
echo.

echo [2/4] Installing dependencies (if needed)...
npm install
echo.

echo [3/4] Running sample test to verify setup...
npm run test -- sample
echo.

echo [4/4] Running Login Page integration tests...
npm run test -- LoginPage
echo.

echo ========================================
echo Test execution complete!
echo ========================================
pause
