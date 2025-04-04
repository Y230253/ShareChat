@echo off
echo ShareChat CORS修正専用デプロイツール
echo ==============================

echo 1. ソースコードをチェック (credentials を使用しているファイルを探す)
echo --------------------------------------------------------------
findstr /s /i /m "credentials" src\*.js src\*.vue
if %ERRORLEVEL% EQU 0 (
  echo 警告: credentialsキーワードを含むファイルが見つかりました。
  echo 上記のファイルを確認し、credentials設定を削除してください。
) else (
  echo OK: credentialsキーワードを含むファイルは見つかりませんでした。
)

echo 2. 環境変数の確認
type .env.production
echo.

echo 3. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 4. 本番環境用にビルド (mode=production)
call npm run build -- --mode production

echo 5. 生成されたJSファイルをチェック (credentials を含むかどうか)
echo -------------------------------------------------------------
cd dist\assets
findstr /s /i "credentials" *.js
if %ERRORLEVEL% EQU 0 (
  echo 警告: 生成されたJSファイルに'credentials'キーワードが含まれています。
  echo ソースコードをさらに確認してください。
) else (
  echo OK: 生成されたJSファイルに'credentials'キーワードは含まれていません。
)
cd ..\..

echo 6. Cloud Storageに古いファイルを削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 7. 新しいファイルをアップロード
gsutil -m cp -r dist\* gs://sharechat-media-bucket/frontend/

echo 8. アクセス権限とキャッシュ設定
gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/**
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/assets/*

echo 9. CORS設定を確認・更新
gsutil cors get gs://sharechat-media-bucket
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo デプロイ完了!
echo.
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo.
echo ブラウザのキャッシュを必ずクリアしてください。
