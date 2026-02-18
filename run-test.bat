@echo off
node --experimental-strip-types scripts\simple-test.ts > test-results.txt 2>&1
type test-results.txt
