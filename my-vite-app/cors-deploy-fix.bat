@echo off
echo ShareChat CORS問題修正デプロイツール
echo ===============================

echo 1. 環境変数の確認
echo 本番APIエンドポイント:
type .env.production
echo.

echo 2. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 3. 本番環境用にビルド
echo NODE_ENV=production > .env.local
call npm run build -- --mode production

echo 4. アセットファイル存在確認
dir dist\assets
if %ERRORLEVEL% NEQ 0 (
  echo エラー: ビルド後のアセットフォルダが存在しません
  exit /b 1
)

echo 5. vite.svg をディストフォルダにコピー
copy public\vite.svg dist\vite.svg
if %ERRORLEVEL% NEQ 0 (
  echo 警告: vite.svg のコピーに失敗しましたが続行します
)

echo 6. Cloud Storageの古いファイルを完全に削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 7. 新しいファイルをアップロード
gsutil -m cp -r dist\* gs://sharechat-media-bucket/frontend/

echo 8. アクセス権限の明示的設定
gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/

echo 9. キャッシュコントロール設定
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:max-age=31536000" gs://sharechat-media-bucket/frontend/assets/*

echo 10. CORS設定の更新
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo デプロイ完了！ブラウザのキャッシュをクリアして確認してください。
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
