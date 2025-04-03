@echo off
echo ShareChat セットアップ＆デプロイスクリプト
echo ====================================

echo 1. cors-config.jsonの存在を確認中...
if not exist "cors-config.json" (
  echo cors-config.jsonが見つかりません。作成します...
  echo [> cors-config.json
  echo   {>> cors-config.json
  echo     "origin": ["*"],>> cors-config.json
  echo     "method": ["GET", "HEAD", "OPTIONS"],>> cors-config.json
  echo     "responseHeader": ["Content-Type", "Content-Length", "Cache-Control", "Content-Language", "Content-Encoding", "Content-Range", "Access-Control-Allow-Origin"],>> cors-config.json
  echo     "maxAgeSeconds": 3600>> cors-config.json
  echo   }>> cors-config.json
  echo ]>> cors-config.json
)

echo 2. バケット設定を実行中...
call .\setup-bucket.bat
if %errorlevel% neq 0 (
  echo バケット設定に失敗しました。
  exit /b 1
)

echo 3. フロントエンドのデプロイを実行中...
call .\deploy-frontend.bat
if %errorlevel% neq 0 (
  echo フロントエンドデプロイに失敗しました。
  exit /b 1
)

echo ====================================
echo セットアップとデプロイが完了しました！
echo アプリケーションURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo ====================================
