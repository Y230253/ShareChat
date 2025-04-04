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

echo 4. Cloud Storageの古いファイルを完全に削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 5. 新しいファイルをアップロード
gsutil -m cp -r dist\* gs://sharechat-media-bucket/frontend/

echo 6. アクセス権限の明示的設定
gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/

echo 7. キャッシュコントロール設定
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:no-cache, max-age=0" gs://sharechat-media-bucket/frontend/assets/*

echo 8. CORS設定の更新
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo 9. 設定の確認
echo CORS設定:
gsutil cors get gs://sharechat-media-bucket

echo インデックスファイルのメタデータ:
gsutil stat gs://sharechat-media-bucket/frontend/index.html

echo デプロイ完了！ブラウザのキャッシュをクリアして確認してください。
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
