@echo off
cd /d %~dp0
node --experimental-strip-types scripts/query-tools.ts %*
