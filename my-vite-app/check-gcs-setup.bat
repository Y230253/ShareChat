@echo off
echo ShareChat Google Cloud Storage 設定確認ツール
echo ============================================

echo 1. Google Cloud 認証情報の確認
echo ----------------------------
gcloud auth list
echo.

echo 2. デフォルトプロジェクト設定
echo -------------------------
gcloud config list project
echo.

echo 3. バケット一覧
echo ------------
gsutil ls
echo.

echo 4. バケット詳細情報
echo ---------------
gsutil ls -L gs://sharechat-media-bucket
echo.

echo 5. バケット内のフォルダ構造
echo ---------------------
echo フロントエンドディレクトリ:
gsutil ls gs://sharechat-media-bucket/frontend/
echo.

echo アップロードディレクトリ:
gsutil ls gs://sharechat-media-bucket/uploads/
echo.

echo データディレクトリ:
gsutil ls gs://sharechat-media-bucket/data/
echo.

echo 6. パーミッション確認テスト
echo --------------------
echo (1) テストファイル作成:
echo "テストコンテンツ" > test.txt
gsutil cp test.txt gs://sharechat-media-bucket/test.txt
if %ERRORLEVEL% NEQ 0 (
  echo エラー: バケットへの書き込み権限がありません。
) else (
  echo バケットへのアップロード: 成功
  gsutil rm gs://sharechat-media-bucket/test.txt
  echo テストファイル削除: 完了
)

echo (2) フロントエンドディレクトリテスト:
echo "テストコンテンツ" > test.txt
gsutil cp test.txt gs://sharechat-media-bucket/frontend/test.txt
if %ERRORLEVEL% NEQ 0 (
  echo エラー: frontend ディレクトリへの書き込み権限がありません。
) else (
  echo フロントエンドディレクトリへのアップロード: 成功
  gsutil rm gs://sharechat-media-bucket/frontend/test.txt
  echo テストファイル削除: 完了
)
del test.txt
https://storage.googleapis.com/sharechat-media-bucket/frontend/.keep
echo.
echo 診断完了
echo ======
echo 問題が解決しない場合は:
echo 1. Google Cloudコンソールで直接バケット設定を確認
echo 2. IAM権限が正しく設定されているか確認
echo 3. バケットのデフォルトアクセス設定を確認
echo 4. サービスアカウントの権限設定を確認
