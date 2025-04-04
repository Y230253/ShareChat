@echo off
echo ShareChat CORS徹底修正ツール
echo =======================

echo 1. ビルドキャッシュのクリーンアップ
rmdir /S /Q node_modules\.vite
rmdir /S /Q .cache
rmdir /S /Q dist

echo 2. 全ファイルをチェック (credentials が含まれているか)
findstr /S /I /M "credentials" src\*.js src\*.vue
if %ERRORLEVEL% EQU 0 (
  echo 警告: credentialsを含むファイルが見つかりました。確認してください。
  pause
)

echo 3. 環境変数を確認
type .env.production
echo.
set /p continue="APIエンドポイント設定は正しいですか？ (Y/N): "
if /i "%continue%" NEQ "Y" (
  echo デプロイを中止します。環境変数を修正してから再実行してください。
  exit /b 1
)

echo 4. 強制的に新規モジュールをクリア＆再構築
rmdir /S /Q node_modules\.cache
call npm run build -- --mode production

echo 5. 生成されたJSファイルを検査
echo "credentials"が含まれているか確認中...
findstr /S /I "credentials" dist\assets\*.js
if %ERRORLEVEL% EQU 0 (
  echo 警告: 生成されたJSファイルに"credentials"が含まれています。
  echo ファイルの内容を確認するか、手動でエディタで開いて削除してください。
  echo 続行する場合、Enter を押してください...
  pause
) else (
  echo OK: 生成されたJSファイルに"credentials"は含まれていません。
)

echo 6. Cloud Storage にデプロイする前に全ファイル削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 7. 新しいファイルをアップロード
gsutil -m cp -r dist\* gs://sharechat-media-bucket/frontend/

echo 8. 権限とキャッシュを設定
gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/**
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/assets/*

echo 9. CORS設定を更新
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo デプロイ完了！
echo.
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo.
echo 必ずブラウザの完全なキャッシュクリアを実行してからアクセスしてください:
echo Chrome/Edge: Ctrl+Shift+Delete → キャッシュをクリア
echo またはシークレットウィンドウで開いてください。
