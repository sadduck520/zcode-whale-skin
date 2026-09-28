@echo off
chcp 65001 >nul
title ZCode 鲸鱼娘皮肤 - 安装
echo ============================================
echo  ZCode 鲸鱼娘皮肤 - 安装
echo  请确认已完全退出 ZCode（包括托盘图标）！
echo ============================================
cd /d "%~dp0"
node swap-skin.mjs install %*
echo.
pause
