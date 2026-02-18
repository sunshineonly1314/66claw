@echo off
node --experimental-strip-types scripts\debug-like.ts > debug-output.txt 2>&1
type debug-output.txt
