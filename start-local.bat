@echo off
REM Double-cliquer pour lancer HyperSignal sur http://localhost:5173
cd /d "%~dp0"
title HyperSignal — localhost:5173
npm run dev
