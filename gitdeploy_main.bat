@echo off
REM ===============================
REM Usage: gitdeploy_main <staging_repo_path> <production_repo_name>
REM Example: gitdeploy_main "C:\projects\dashieapp_staging" dashieapp
REM ===============================

if "%~1"=="" (
    echo ❌ Please provide the path to your staging repo.
    echo Example: %0 "C:\projects\dashieapp_staging" dashieapp
    exit /b 1
)

if "%~2"=="" (
    echo ❌ Please provide the production repo name.
    echo Example: %0 "C:\projects\dashieapp_staging" dashieapp
    exit /b 1
)

set STAGING_PATH=%~1
set PROD_REPO_NAME=%~2
set GITHUB_USER=jwlerch78
set PROD_REPO_URL=https://github.com/%GITHUB_USER%/%PROD_REPO_NAME%.git

echo.
echo 🚀 Deploying from: %STAGING_PATH%
echo ➡️  To: %PROD_REPO_URL%
echo.

REM Ensure we are on main branch
echo 🔄 Switching to main branch...
git checkout main
if errorlevel 1 (
    echo ❌ Failed to checkout main branch.
    exit /b 1
)

REM Check for uncommitted changes
echo 🔎 Checking for uncommitted changes...
git diff-index --quiet HEAD --
if not "%errorlevel%"=="0" (
    echo ❌ You have uncommitted changes in %STAGING_PATH%.
    echo Please commit or stash them before deploying.
    exit /b 1
)

REM Pull latest changes from staging main
echo 🔄 Pulling latest changes from origin main...
git pull origin main
if errorlevel 1 (
    echo ❌ Failed to pull latest changes.
    exit /b 1
)

REM Add production remote if not already added
git remote get-url %PROD_REPO_NAME% >nul 2>&1
if errorlevel 1 (
    echo 🔗 Adding remote %PROD_REPO_NAME%...
    git remote add %PROD_REPO_NAME% %PROD_REPO_URL%
)

REM Push main to production main without force
echo 📤 Pushing to %PROD_REPO_NAME% main branch...
git push %PROD_REPO_NAME% main:main
if errorlevel 1 (
    echo ❌ Push failed. Check your credentials or network.
    exit /b 1
)

echo.
echo ✅ Successfully pushed main branch to %PROD_REPO_NAME% main.
echo It should deploy now if GitHub Actions or Vercel is set up.
pause
