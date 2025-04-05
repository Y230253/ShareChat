@echo off
echo ShareChat バケットポリシー更新ツール
echo ==============================

echo 1. 環境変数の設定
set BUCKET_NAME=sharechat-media-bucket

echo 2. バケット情報の確認
gsutil ls -L gs://%BUCKET_NAME%

echo 3. 統一バケットレベルアクセス設定の確認
gsutil uniformbucketlevelaccess get gs://%BUCKET_NAME%

echo 4. バケットの全オブジェクトに公開読み取りアクセスを許可
gsutil iam ch allUsers:objectViewer gs://%BUCKET_NAME%

echo 5. 統一バケットレベルアクセス設定を有効化
gsutil uniformbucketlevelaccess set on gs://%BUCKET_NAME%

echo 6. CORS設定の更新
gsutil cors set cors-config.json gs://%BUCKET_NAME%

echo バケット設定が更新されました
echo これで /upload エンドポイント問題が解消されるはずです
