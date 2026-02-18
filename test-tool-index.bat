@echo off
echo Testing Tool Index System
echo ========================
echo.

echo [1] Testing Chinese query: 微信
node --experimental-strip-types scripts\query-tools.ts 微信 --limit 5
echo.

echo [2] Testing English query: search
node --experimental-strip-types scripts\query-tools.ts search --type mcp --limit 5
echo.

echo [3] Testing short query: AI
node --experimental-strip-types scripts\query-tools.ts AI --limit 3
echo.

echo [4] Checking index stats
node --experimental-strip-types scripts\check-tool-index.ts
echo.

echo Done!
pause
