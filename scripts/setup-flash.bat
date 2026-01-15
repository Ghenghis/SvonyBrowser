@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Svony Browser - Flash Player Setup
echo ============================================
echo.

set "FLASHVER_DIR=%~dp0..\flashver"
set "FOUND_FLASH=0"

echo Checking for Flash Player files...
echo.

REM Check if Flash is already installed
if exist "%FLASHVER_DIR%\pepflashplayer64_32_0_0_465.dll" (
    echo [OK] Flash Player 64-bit found!
    set "FOUND_FLASH=1"
)
if exist "%FLASHVER_DIR%\pepflashplayer32_32_0_0_465.dll" (
    echo [OK] Flash Player 32-bit found!
    set "FOUND_FLASH=1"
)

if "%FOUND_FLASH%"=="1" (
    echo.
    echo Flash Player is already installed!
    echo.
    pause
    exit /b 0
)

echo [!] Flash Player NOT found in flashver directory.
echo.
echo Looking for Flash Player in common locations...
echo.

REM Check FlashBrowser installation
set "FB_PATH=%LOCALAPPDATA%\Programs\FlashBrowser"
if exist "%FB_PATH%\pepflashplayer64_32_0_0_465.dll" (
    echo [FOUND] FlashBrowser installation at: %FB_PATH%
    echo Copying Flash Player files...
    copy "%FB_PATH%\pepflashplayer64_32_0_0_465.dll" "%FLASHVER_DIR%\" >nul
    if exist "%FB_PATH%\swiftshader" (
        xcopy "%FB_PATH%\swiftshader" "%FLASHVER_DIR%\swiftshader\" /E /I /Y >nul
    )
    echo [OK] Flash Player copied successfully!
    goto :create_manifest
)

REM Check Chrome PepperFlash
set "CHROME_FLASH=%LOCALAPPDATA%\Google\Chrome\User Data\PepperFlash"
if exist "%CHROME_FLASH%" (
    for /d %%v in ("%CHROME_FLASH%\*") do (
        if exist "%%v\pepflashplayer64_32_0_0_465.dll" (
            echo [FOUND] Chrome Flash at: %%v
            copy "%%v\pepflashplayer64_32_0_0_465.dll" "%FLASHVER_DIR%\" >nul
            echo [OK] Flash Player copied successfully!
            goto :create_manifest
        )
    )
)

REM Check System Flash
set "SYS_FLASH=%WINDIR%\System32\Macromed\Flash"
if exist "%SYS_FLASH%\pepflashplayer64_32_0_0_465.dll" (
    echo [FOUND] System Flash at: %SYS_FLASH%
    copy "%SYS_FLASH%\pepflashplayer64_32_0_0_465.dll" "%FLASHVER_DIR%\" >nul
    echo [OK] Flash Player copied successfully!
    goto :create_manifest
)

echo.
echo ============================================
echo   Flash Player NOT Found
echo ============================================
echo.
echo Please obtain Flash Player from one of these sources:
echo.
echo 1. Download FlashBrowser from:
echo    https://github.com/radubirsan/FlashBrowser/releases
echo    Install it, then run this script again.
echo.
echo 2. Download from Internet Archive:
echo    https://archive.org/details/flashplayerarchive
echo.
echo 3. Manually copy pepflashplayer64_32_0_0_465.dll to:
echo    %FLASHVER_DIR%
echo.
echo Press any key to open FlashBrowser releases page...
pause >nul
start https://github.com/radubirsan/FlashBrowser/releases
exit /b 1

:create_manifest
echo.
echo Creating manifest.json...

REM Find the actual DLL name
for %%f in ("%FLASHVER_DIR%\pepflashplayer*.dll") do (
    set "DLL_NAME=%%~nxf"
)

echo {> "%FLASHVER_DIR%\manifest.json"
echo   "name": "Shockwave Flash",>> "%FLASHVER_DIR%\manifest.json"
echo   "description": "Shockwave Flash 32.0 r0",>> "%FLASHVER_DIR%\manifest.json"
echo   "version": "32.0.0.465",>> "%FLASHVER_DIR%\manifest.json"
echo   "x-ppapi-arch": "x64",>> "%FLASHVER_DIR%\manifest.json"
echo   "x-ppapi-file": "!DLL_NAME!",>> "%FLASHVER_DIR%\manifest.json"
echo   "mime_types": [>> "%FLASHVER_DIR%\manifest.json"
echo     {>> "%FLASHVER_DIR%\manifest.json"
echo       "mime_type": "application/x-shockwave-flash",>> "%FLASHVER_DIR%\manifest.json"
echo       "description": "Shockwave Flash",>> "%FLASHVER_DIR%\manifest.json"
echo       "file_extensions": [".swf"]>> "%FLASHVER_DIR%\manifest.json"
echo     }>> "%FLASHVER_DIR%\manifest.json"
echo   ]>> "%FLASHVER_DIR%\manifest.json"
echo }>> "%FLASHVER_DIR%\manifest.json"

echo [OK] manifest.json created!
echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo Flash Player has been configured.
echo You can now run Svony Browser.
echo.
pause
