@echo off
REM Thin wrapper: scripts\sb.cmd db push
node "%~dp0sb.mjs" %*
