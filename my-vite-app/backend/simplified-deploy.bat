@echo off
echo ShareChat シンプルデプロイスクリプト
echo ===================================

REM 環境変数の設定
set PROJECT_ID=sharechat-455513
set REGION=asia-northeast1
set SERVICE_NAME=sharechat-backend
set BUCKET_NAME=sharechat-media-bucket

echo 1. 簡易版バックエンドサーバーをデプロイ（テスト用）
gcloud run deploy %SERVICE_NAME%-test ^
  --source . ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars="PORT=8080,NODE_ENV=production"

echo 2. デプロイされたURLを取得
for /f %%i in ('gcloud run services describe %SERVICE_NAME%-test --platform managed --region %REGION% --format="value(status.url)"') do set SERVICE_URL=%%i

echo サービスURL: %SERVICE_URL%
echo サービスにアクセスして動作確認してください。

echo 3. 簡単なブラウザテスト
start "" %SERVICE_URL%
