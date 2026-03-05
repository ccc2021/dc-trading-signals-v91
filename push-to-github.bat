@echo off
chcp 65001 >nul
title DC Trading Signals Pro v9.1 - GitHub 部署

echo ═══════════════════════════════════════════════════════════════
echo   DC Trading Signals Pro v9.1
echo   GitHub 部署腳本
echo ═══════════════════════════════════════════════════════════════
echo.

:: 檢查 gh
where gh >nul 2>nul
if %errorlevel% neq 0 (
    echo [提示] 請先安裝 GitHub CLI
    echo 下載: https://cli.github.com/
    pause
    exit /b 1
)

echo [1/4] 登入 GitHub...
gh auth status >nul 2>nul
if %errorlevel% neq 0 (
    gh auth login
)

echo.
echo [2/4] 創建 GitHub 倉庫...
set REPO_NAME=dc-trading-signals-v91
gh repo create %REPO_NAME% --public --description "DC Trading Signals Pro v9.1" 2>nul

echo.
echo [3/4] 設定遠端並推送...
for /f "tokens=*" %%i in ('gh api user -q .login') do set GITHUB_USER=%%i
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git
git push -u origin main --force

echo.
echo [4/4] 完成！
echo.
echo ═══════════════════════════════════════════════════════════════
echo   ✅ 部署成功！
echo.
echo   倉庫地址: https://github.com/%GITHUB_USER%/%REPO_NAME%
echo ═══════════════════════════════════════════════════════════════
pause
