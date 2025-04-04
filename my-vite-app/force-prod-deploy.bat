@echo off
echo ShareChat 本番用強制デプロイツール
echo =============================

echo 1. 環境変数確認
echo 本番APIエンドポイント:
findstr "VITE_API_BASE_URL" .env.production

echo 2. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 3. 本番環境用にビルド
echo "NODE_ENV=production" > .env.local
call npm run build -- --mode production

echo 4. 生成されたindex.htmlを確認
type dist\index.html
echo.

echo 5. Cloud Storageの古いファイルを削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 6. 新しいファイルをアップロード
gsutil -m cp -r dist\* gs://sharechat-media-bucket/frontend/

echo 7. 権限設定
gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/

echo 8. キャッシュコントロール設定
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/assets/*

echo 9. CORS設定の更新
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo デプロイ完了！
echo ブラウザのキャッシュをクリアして確認してください。
echo.
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
