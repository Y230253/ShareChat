@echo off
echo ShareChat デプロイ状態確認スクリプト
echo ====================================

echo 1. バックエンドサービスの状態確認
gcloud run services describe sharechat-backend --region=asia-northeast1

echo 2. バックエンドのログ確認（最新エラーを含む直近のログ）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sharechat-backend AND severity>=ERROR" --limit=10

echo 3. バックエンドの一般ログ確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sharechat-backend" --limit=20 --format="value(textPayload)"

echo 4. エンドポイントにアクセス
curl -v https://sharechat-backend-n3c7jkxkna-an.a.run.app

echo 5. ヘルスチェックエンドポイント
curl -v https://sharechat-backend-n3c7jkxkna-an.a.run.app/health

echo 6. Cloud Storage バケットのアクセス設定確認
gcloud storage buckets describe gs://sharechat-media-bucket --format="default(iamConfiguration)"

echo 7. データファイルの存在確認
gcloud storage ls gs://sharechat-media-bucket/data/

echo 8. サービスアカウント権限確認
gcloud run services describe sharechat-backend --region=asia-northeast1 --format="value(spec.template.spec.serviceAccountName)"
