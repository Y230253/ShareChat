@echo off
echo ShareChat バックエンドデプロイスクリプト (App Engine用)
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
set BUCKET_NAME=sharechat-media-bucket

echo 4. npmパッケージのインストール
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo エラー: npm installに失敗しました
  exit /b 1
)

echo 5. app.yamlの確認
if not exist "app.yaml" (
  echo エラー: app.yamlが存在しません！
  exit /b 1
)

echo 6. App Engineにデプロイ
gcloud app deploy app.yaml --quiet
if %ERRORLEVEL% NEQ 0 (
  echo エラー: App Engineへのデプロイに失敗しました
  exit /b 1
)

echo 7. デプロイしたURLを表示
gcloud app browse

echo デプロイ完了！上記のURLがバックエンドのエンドポイントです。
echo フロントエンド環境変数(.env.production)を更新してください。
for /f "tokens=*" %%i in ('gcloud app describe --format="value(defaultHostname)"') do set APP_URL=https://%%i
echo VITE_API_BASE_URL=%APP_URL% > ..\.env.production
echo 環境変数ファイルを確認してください。
