@echo off
echo === Tauri Build v1.1.23 (MSVC + Rust stable, JOBS=1) ===
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to initialize MSVC environment
    exit /b 1
)
REM Remove Git paths to prevent link.exe conflict
set PATH=%PATH:E:\Program Files\Git\usr\bin;=%
set PATH=%PATH:C:\Program Files\Git\usr\bin;=%
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
set RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc
set CARGO_BUILD_JOBS=1
echo LINK:
where link.exe 2>nul | findstr /i /v git | findstr /i link
echo RUSTC:
rustc --version
echo JOBS: %CARGO_BUILD_JOBS%
cd /d "D:\codeknowledge\clawdbot-main\clawdbot-main\apps\desktop\src-tauri"
cargo clean --release
cd /d "D:\codeknowledge\clawdbot-main\clawdbot-main\apps\desktop"
pnpm tauri build
exit /b %ERRORLEVEL%
