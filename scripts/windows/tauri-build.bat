@echo off
REM Build Tauri application using CLI with proper environment

cd /d "%~dp0tauri-src"

REM Setup Rust environment
call "%USERPROFILE%\.cargo\env.bat"

REM Setup MSVC environment
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

echo ========================================
echo Building ClawdbotCN with Tauri CLI v2
echo ========================================
echo.
echo Frontend: ../../../dist/control-ui
echo This will properly embed frontend resources into the executable.
echo.

pnpm tauri build --verbose

echo.
echo ========================================
echo Build Complete
echo ========================================
