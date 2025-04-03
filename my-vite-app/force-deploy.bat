@echo off
echo ShareChat 強制デプロイツール
echo ===========================

echo 1. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 2. 新規ビルド
call npm run build

echo 3. Cloud Storageの古いファイルを削除
gsutil -m rm -r gs://sharechat-media-bucket/frontend/*

echo 4. 新しいファイルをアップロード
gsutil -m cp -r dist/* gs://sharechat-media-bucket/frontend/

echo 5. キャッシュコントロールの設定
gsutil -m setmeta -h "Cache-Control:no-cache, max-age=0" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:no-cache, max-age=0" gs://sharechat-media-bucket/frontend/*.js
gsutil -m setmeta -h "Cache-Control:no-cache, max-age=0" gs://sharechat-media-bucket/frontend/*.css

echo 6. デプロイ確認
gsutil ls -la gs://sharechat-media-bucket/frontend/

echo 強制デプロイ完了！
echo ブラウザのキャッシュをクリアしてアクセスしてください。
