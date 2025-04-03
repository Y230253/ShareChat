@echo off
echo ShareChat デプロイ確認ツール
echo ===========================

echo 1. フロントエンドディレクトリの内容確認
gsutil ls -la gs://sharechat-media-bucket/frontend/

echo 2. index.htmlの内容確認
gsutil cat gs://sharechat-media-bucket/frontend/index.html

echo 3. すべての古いキャッシュを無効化
gsutil -m setmeta -h "Cache-Control:no-cache, max-age=0" gs://sharechat-media-bucket/frontend/**

echo デプロイ確認完了
