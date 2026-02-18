@echo off
node --experimental-strip-types scripts\debug-fts.ts > fts-debug-output.txt 2>&1
type fts-debug-output.txt
