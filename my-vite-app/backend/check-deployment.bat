@echo off
echo ShareChat デプロイ状態確認スクリプト
echo ====================================

echo 1. バックエンドサービスの状態確認
gcloud run services describe sharechat-backend --region=asia-northeast1

echo 2. バックエンドのログ確認（最新のログ）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sharechat-backend" --limit=20

echo 3. エンドポイントのテスト
set /p URL=https://sharechat-backend-n3c7jkxkna-an.a.run.app
curl -v %URL%

echo 4. Cloud Storage バケットのアクセス設定確認
gcloud storage buckets describe gs://sharechat-media-bucket --format="default(iamConfiguration)"
