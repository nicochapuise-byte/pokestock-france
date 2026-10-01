@echo off
title PokeStock France - Local
echo.
echo ==========================================
echo       PokeStock France - Demarrage
echo ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js n'est pas installe.
  echo Installe Node.js LTS depuis https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installation des dependances...
  call npm install
  if %errorlevel% neq 0 (
    echo.
    echo Erreur pendant npm install.
    pause
    exit /b 1
  )
)

echo.
echo Demarrage du site...
echo Ouvre ensuite : http://localhost:3000
echo.
call npm run dev
pause
