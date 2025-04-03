@echo off
echo ShareChat バックエンドデプロイスクリプト
echo ====================================

echo 1. 環境と認証を確認しています...
echo Google Cloud 認証状態:
call gcloud auth list
echo.

REM 認証チェック
echo 認証を確認中...
gcloud config get-value account > nul
if %ERRORLEVEL% NEQ 0 (
  echo エラー: Google Cloudで認証されていません。
  echo 実行してください: gcloud auth login
  exit /b 1
)

echo 2. バックエンドプロジェクト設定を確認しています...
echo 現在のプロジェクト:
call gcloud config get-value project
if %ERRORLEVEL% NEQ 0 (
  echo エラー: プロジェクトが設定されていません。
  echo プロジェクトを設定してください: gcloud config set project [PROJECT_ID]
  exit /b 1
)

echo 3. バックエンドをビルドしています...
cd /d %~dp0\backend
if not exist "package.json" (
  echo エラー: package.jsonが見つかりません。正しいディレクトリにいることを確認してください。
  exit /b 1
)

call npm install
if %ERRORLEVEL% NEQ 0 (
  echo エラー: 依存関係のインストールに失敗しました。
  exit /b 1
)

call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo エラー: バックエンドのビルドに失敗しました。
  exit /b 1
)

echo 4. アプリケーションをデプロイしています...
echo デプロイ先を選択してください:
echo [1] Google App Engine
echo [2] Cloud Run
echo [3] Compute Engine
set /p deploy_option="選択 (1-3): "

if "%deploy_option%"=="1" (
  echo Google App Engine にデプロイしています...
  call gcloud app deploy app.yaml --quiet
  if %ERRORLEVEL% NEQ 0 (
    echo エラー: App Engine へのデプロイに失敗しました。
    exit /b 1
  )
  echo デプロイURL:
  call gcloud app browse
) else if "%deploy_option%"=="2" (
  echo Cloud Run にデプロイしています...
  echo サービス名を入力してください:
  set /p service_name="サービス名: "
  
  echo Docker イメージをビルドしています...
  call gcloud builds submit --tag gcr.io/%DEVSHELL_PROJECT_ID%/%service_name%
  
  echo Cloud Run サービスをデプロイしています...
  call gcloud run deploy %service_name% --image gcr.io/%DEVSHELL_PROJECT_ID%/%service_name% --platform managed --allow-unauthenticated
  if %ERRORLEVEL% NEQ 0 (
    echo エラー: Cloud Run へのデプロイに失敗しました。
    exit /b 1
  )
) else if "%deploy_option%"=="3" (
  echo Compute Engine へのデプロイは手動設定が必要です。
  echo インスタンスにSSH接続して、コードをデプロイしてください。
) else (
  echo 無効な選択です。デプロイを中止します。
  exit /b 1
)

echo バックエンドのデプロイが完了しました！
echo ====================================
echo デプロイ後の確認事項:
echo 1. 環境変数が正しく設定されているか
echo 2. データベース接続が正常か
echo 3. API エンドポイントが正しく応答するか
echo 4. ログを確認して異常がないか

exit /b 0
