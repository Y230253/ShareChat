@echo off
echo ShareChat クリーンデプロイツール
echo ===========================

echo 1. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 2. 新規ビルド
call npm run build

echo 3. Cloud Storageの特に重要な古いファイルを確実に削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/index.html
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/assets/
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/vite.svg

echo 4. 新しいファイルをアップロード
gsutil -m cp -r dist/* gs://sharechat-media-bucket/frontend/

echo 5. キャッシュコントロールの設定
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" gs://sharechat-media-bucket/frontend/assets/*

echo 6. アクセス権限の明示的設定
gsutil -m acl ch -u AllUsers:R gs://sharechat-media-bucket/frontend/index.html
gsutil -m acl ch -u AllUsers:R gs://sharechat-media-bucket/frontend/assets/*
gsutil -m acl ch -u AllUsers:R gs://sharechat-media-bucket/frontend/vite.svg

echo 7. デプロイ確認
gsutil ls -la gs://sharechat-media-bucket/frontend/
gsutil ls -la gs://sharechat-media-bucket/frontend/assets/

echo クリーンデプロイ完了！
echo ブラウザのキャッシュをクリアしてアクセスしてください。
