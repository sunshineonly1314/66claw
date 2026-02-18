@echo off
node --experimental-strip-types scripts\verify-query-logic.ts > test-output.txt 2>&1
type test-output.txt
