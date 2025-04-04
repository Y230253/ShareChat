@echo off
echo ShareChat バックエンドデプロイスクリプト (Cloud Run用)
echo ==================================================

echo 1. 認証状態の確認
gcloud auth list
gcloud config get-value project
echo.

echo 2. サービスアカウントキーの確認
if not exist "gcp-key.json" (
  echo エラー: gcp-key.jsonが存在しません！
  echo Google Cloud Consoleでサービスアカウントキーを作成し、backend/gcp-key.jsonとして保存してください。
  exit /b 1
)
echo サービスアカウントキー確認完了

echo 3. 環境変数設定
set PROJECT_ID=sharechat-455513
set REGION=asia-northeast1
set SERVICE_NAME=sharechat-backend
set BUCKET_NAME=sharechat-media-bucket

echo 4. npmパッケージのインストール
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo エラー: npm installに失敗しました
  exit /b 1
)

echo 5. Cloud Storageの初期化
echo バケットとデータファイルの初期設定を行います...
set GOOGLE_CLOUD_PROJECT_ID=%PROJECT_ID%
set GOOGLE_CLOUD_STORAGE_BUCKET=%BUCKET_NAME%
node initialize-storage.js
if %ERRORLEVEL% NEQ 0 (
  echo 警告: ストレージの初期化に問題がありました。処理を続行します。
)

echo 6. Cloud Runにデプロイ
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend
if %ERRORLEVEL% NEQ 0 (
  echo エラー: イメージのビルド/アップロードに失敗しました
  echo リポジトリが作成されていることを確認してください。
  echo 作成するには: gcloud artifacts repositories create sharechat-repo --repository-format=docker --location=asia-northeast1 --description="ShareChat repository"
  exit /b 1
)

echo 7. サービスのデプロイ
gcloud run deploy sharechat-backend 
  --image asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend 
  --platform managed 
  --region asia-northeast1 
  --allow-unauthenticated 
  --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT_ID=sharechat-455513,GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket,JWT_SECRET=nishichopass"

echo 8. デプロイしたURLを取得
for /f %%i in ('gcloud run services describe %SERVICE_NAME% --platform managed --region %REGION% --format="value(status.url)"') do set SERVICE_URL=%%i

echo 9. ブラウザでサービスを開く
start "" %SERVICE_URL%

echo 10. フロントエンド環境変数の更新
echo VITE_API_BASE_URL=%SERVICE_URL% > ..\.env.production
echo VITE_APP_VERSION=1.0.0 >> ..\.env.production
echo VITE_APP_BUILD_DATE=%date% >> ..\.env.production

echo デプロイ完了！
echo バックエンドURL: %SERVICE_URL%
echo フロントエンドの環境変数を更新しました。
echo フロントエンドを再デプロイするには:
echo cd .. && hash-router-deploy.bat
