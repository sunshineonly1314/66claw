@echo off
REM Run Tauri in development mode (connects to localhost:5173)

cd /d "%~dp0tauri-src"

REM Setup Rust environment
call "%USERPROFILE%\.cargo\env.bat"

REM Setup MSVC environment
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

echo Starting Tauri in development mode...
echo This will connect to http://localhost:5173
echo.

cargo run
