@echo off
echo ========================================
echo Test 1: 微信 (short Chinese, triggers LIKE fallback)
echo ========================================
node --experimental-strip-types scripts\query-tools.ts 微信 --limit 5
echo.

echo ========================================
echo Test 2: 地图导航 (4 chars, triggers FTS5 3-gram)
echo ========================================
node --experimental-strip-types scripts\query-tools.ts 地图导航 --limit 5 --type mcp
echo.

echo ========================================
echo Test 3: search (English)
echo ========================================
node --experimental-strip-types scripts\query-tools.ts search --limit 5 --china
echo.

echo ========================================
echo Test 4: 文件管理 (Skills only)
echo ========================================
node --experimental-strip-types scripts\query-tools.ts 文件管理 --limit 3 --type skill
echo.

echo ✅ All tests completed!
