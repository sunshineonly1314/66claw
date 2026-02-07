@echo off
:: Prepare production node_modules for packaging
:: Run this before building the installer
:: Uses China npm mirror for faster downloads

cd /d "%~dp0..\.."

echo Setting npm registry to China mirror (npmmirror.com)...
call npm config set registry https://registry.npmmirror.com

echo Cleaning existing node_modules...
if exist "scripts\windows\node_modules_prod" rmdir /s /q "scripts\windows\node_modules_prod"

echo Installing production dependencies only (using China mirror)...
call npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry=https://registry.npmmirror.com

echo Copying to packaging directory...
mkdir "scripts\windows\node_modules_prod"
xcopy /e /i /h /y "node_modules" "scripts\windows\node_modules_prod"

echo Done! node_modules_prod is ready for packaging.
echo Size:
dir /s "scripts\windows\node_modules_prod" | findstr "File(s)"

pause
