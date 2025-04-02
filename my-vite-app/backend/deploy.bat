@echo off
echo ShareChat デプロイスクリプト
echo ============================

echo 0. フロントエンドのビルドファイルをバックエンドディレクトリにコピー
IF NOT EXIST "dist" mkdir dist
xcopy /E /Y "..\dist" "dist\"

echo 1. バックエンドイメージのビルドとプッシュ
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend

echo 2. Cloud Run へのデプロイ
gcloud run deploy sharechat-backend ^
  --image asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend ^
  --platform managed ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT_ID=sharechat-455513,GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket,JWT_SECRET=sharechat_app_secret_key_1234567890"

echo 3. デプロイしたURLを取得
gcloud run services describe sharechat-backend --platform managed --region asia-northeast1 --format="value(status.url)"

echo デプロイ完了！上記のURLがバックエンドのエンドポイントです。
