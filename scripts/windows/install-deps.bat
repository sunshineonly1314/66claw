@echo off
setlocal enabledelayedexpansion
title ClawdbotCN - An Zhuang Yi Lai

cd /d "%~dp0"

echo.
echo  ============================================================
echo.
echo        ClawdbotCN - Zheng Zai An Zhuang Yi Lai Bao
echo.
echo  ============================================================
echo.
echo        QING WU GUAN BI CI CHUANG KOU
echo        Do not close this window
echo.
echo        Shi Yong Guo Nei Jing Xiang Jia Su Xia Zai
echo        Using China mirror for faster download
echo.
echo        Yu Ji Xu Yao 1-3 Fen Zhong...
echo.
echo  ============================================================
echo.

set "NODE_PATH=%~dp0node"
set "NPM_CMD=!NODE_PATH!\npm.cmd"
set "PATH=!NODE_PATH!;%PATH%"

echo   [1/3] Jian Cha Node.js...
if not exist "!NODE_PATH!\node.exe" (
    echo         [X] Node.js Wei Zhao Dao
    pause
    exit /b 1
)
echo         [OK] Node.js Yi Jiu Xu
echo.

echo   [2/3] Pei Zhi Guo Nei Jing Xiang...
call "!NPM_CMD!" config set registry https://registry.npmmirror.com
echo         [OK] Jing Xiang Yi Pei Zhi
echo.

echo   [3/3] An Zhuang Yi Lai Bao...
echo         Zheng Zai Xia Zai, Qing Nai Xin Deng Dai...
echo.

call "!NPM_CMD!" install --omit=dev --legacy-peer-deps --no-audit --no-fund

if !ERRORLEVEL! neq 0 (
    echo.
    echo         [!] Xia Zai Shi Bai, Qie Huan Teng Xun Jing Xiang...
    call "!NPM_CMD!" config set registry https://mirrors.cloud.tencent.com/npm
    call "!NPM_CMD!" install --omit=dev --legacy-peer-deps --no-audit --no-fund
)

if !ERRORLEVEL! neq 0 (
    echo.
    echo  ============================================================
    echo.
    echo        [X] Yi Lai An Zhuang Shi Bai
    echo.
    echo  ============================================================
    echo.
    echo   Qing Jian Cha Wang Luo Lian Jie Hou Chong Shi
    echo   Please check network and try again
    echo.
    pause
    exit /b 1
)

echo.
echo   [4/4] An Zhuang Cha Jian Yi Lai...
echo         Installing extension dependencies...
echo.

REM Feishu - xu yao @larksuiteoapi/node-sdk (Fei Shu Guan Fang SDK)
if exist "extensions\feishu\package.json" (
    echo         Installing Feishu dependencies...
    pushd extensions\feishu
    call "!NPM_CMD!" install --omit=dev --legacy-peer-deps --no-audit --no-fund 2>nul
    if !ERRORLEVEL! equ 0 (
        echo         [OK] Feishu Fei Shu
    ) else (
        echo         [!] Feishu an zhuang shi bai, fei guan jian
    )
    popd
)

REM DingTalk - xu yao dingtalk-stream
if exist "extensions\dingtalk\package.json" (
    echo         Installing DingTalk dependencies...
    pushd extensions\dingtalk
    call "!NPM_CMD!" install --omit=dev --legacy-peer-deps --no-audit --no-fund 2>nul
    if !ERRORLEVEL! equ 0 (
        echo         [OK] DingTalk Ding Ding
    ) else (
        echo         [!] DingTalk an zhuang shi bai, fei guan jian
    )
    popd
)

REM WeCom
if exist "extensions\wecom\package.json" (
    echo         Installing WeCom dependencies...
    pushd extensions\wecom
    call "!NPM_CMD!" install --omit=dev --legacy-peer-deps --no-audit --no-fund 2>nul
    if !ERRORLEVEL! equ 0 (
        echo         [OK] WeCom Qi Ye Wei Xin
    ) else (
        echo         [!] WeCom an zhuang shi bai, fei guan jian
    )
    popd
)

echo.
echo  ============================================================
echo.
echo        [OK] Yi Lai An Zhuang Cheng Gong
echo        Bao Kuo: Zhu Cheng Xu + Fei Shu + Ding Ding + Qi Wei
echo.
echo  ============================================================
echo.
echo   Zheng Zai Qi Dong ClawdbotCN...
timeout /t 2 /nobreak >nul
exit /b 0
