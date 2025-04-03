@echo off
echo ShareChat バケット設定スクリプト
echo ====================================

echo 前提条件の確認...
if not exist "cors-config.json" (
  echo エラー: cors-config.jsonが見つかりません。
  echo cors-config.jsonを同じディレクトリに作成してから再実行してください。
  exit /b 1
)

echo 1. バケットのCORS設定を更新しています...
gsutil cors set cors-config.json gs://sharechat-media-bucket
if %ERRORLEVEL% NEQ 0 (
  echo エラー: CORS設定の更新に失敗しました。
  echo バケットが存在し、適切な権限があることを確認してください。
  exit /b 1
)
echo CORS設定を検証しています...
gsutil cors get gs://sharechat-media-bucket
echo CORS設定が完了しました。

echo 2. バケットの公開アクセス設定を行っています...
echo 注意: バケットが公開読み取り可能になります

REM バケットへのパブリックアクセスをIAM経由で許可
gsutil iam ch allUsers:objectViewer gs://sharechat-media-bucket
echo バケットを公開設定しました。

echo 3. frontendディレクトリを作成しています...
echo テスト用のファイルを作成...
gsutil cp NUL gs://sharechat-media-bucket/frontend/.keep
if %ERRORLEVEL% NEQ 0 (
  echo エラー: frontendディレクトリの作成に失敗しました。
  exit /b 1
)
echo frontendディレクトリを確認...
gsutil ls gs://sharechat-media-bucket/frontend/
echo frontendディレクトリを作成しました。

echo 4. バケットのウェブサイト設定を構成しています...
gsutil web set -m frontend/index.html -e frontend/index.html gs://sharechat-media-bucket
if %ERRORLEVEL% NEQ 0 (
  echo 警告: ウェブサイト設定に失敗しましたが、処理を続行します。
  echo プロジェクトに適切な権限があるか確認してください。
)
echo ウェブサイト設定が完了しました。

echo 5. バケットの設定を確認しています...
gsutil ls gs://sharechat-media-bucket/
echo -----
echo ウェブサイト設定:
gsutil web get gs://sharechat-media-bucket
echo -----
echo IAM権限:
gsutil iam get gs://sharechat-media-bucket

echo バケット設定が完了しました！
echo アクセスURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo -----
echo 続けてフロントエンドをデプロイするには:
echo .\deploy-frontend.bat を実行してください。
