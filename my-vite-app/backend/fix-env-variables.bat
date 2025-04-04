@echo off
echo ShareChat 環境変数修正スクリプト
echo ===============================

echo 1. 認証状態の確認
gcloud auth list
gcloud config get-value project
echo.

echo 2. 環境変数設定
set PROJECT_ID=sharechat-455513
set REGION=asia-northeast1
set SERVICE_NAME=sharechat-backend
set BUCKET_NAME=sharechat-media-bucket

echo 3. 既存のバケット確認
gsutil ls | findstr "%BUCKET_NAME%"
if %ERRORLEVEL% NEQ 0 (
  echo 警告: バケット %BUCKET_NAME% が見つかりません。作成します...
  gsutil mb -l %REGION% gs://%BUCKET_NAME%
  if %ERRORLEVEL% NEQ 0 (
    echo エラー: バケットの作成に失敗しました
    exit /b 1
  )
  echo バケット作成完了
) else (
  echo バケット %BUCKET_NAME% は存在しています
)

echo 4. Cloud Storageの初期化
echo バケットとデータファイルの初期設定を行います...
set GOOGLE_CLOUD_PROJECT_ID=%PROJECT_ID%
set GOOGLE_CLOUD_STORAGE_BUCKET=%BUCKET_NAME%
node initialize-storage.js
if %ERRORLEVEL% NEQ 0 (
  echo 警告: ストレージの初期化に問題がありました。処理を続行します。
)

echo 5. Cloud Run サービスの環境変数を更新
gcloud run services update %SERVICE_NAME% ^
  --platform managed ^
  --region %REGION% ^
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=%PROJECT_ID%,GOOGLE_CLOUD_STORAGE_BUCKET=%BUCKET_NAME%,JWT_SECRET=sharechat_app_secret_key_1234567890"

echo 6. サービスの再起動
gcloud run services update %SERVICE_NAME% ^
  --platform managed ^
  --region %REGION% ^
  --clear-revision-tags

echo 環境変数の修正完了！
echo サービスURLを確認: 
gcloud run services describe %SERVICE_NAME% --platform managed --region %REGION% --format="value(status.url)"
echo ヘルスチェックを実行するには:
for /f %%i in ('gcloud run services describe %SERVICE_NAME% --platform managed --region %REGION% --format="value(status.url)"') do echo curl %%i/health
