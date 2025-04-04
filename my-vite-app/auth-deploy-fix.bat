@echo off
echo ShareChat 認証URL問題修正デプロイツール
echo ==================================

echo 1. 環境変数の確認
echo 本番APIエンドポイント:
findstr "VITE_API_BASE_URL" .env.production
if %ERRORLEVEL% NEQ 0 (
  echo 警告: 本番APIエンドポイントが設定されていません。
  echo VITE_API_BASE_URL=https://sharechat-backend-1047875971594.asia-northeast1.run.app > .env.production
  echo 自動的に設定を追加しました。
)

echo 2. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 3. 本番環境用にビルド
call npm run build -- --mode production

echo 4. アセット参照方法を確認
type dist\index.html
echo.
echo アセット参照が適切かチェックしてください。相対パスで参照しているはずです。

echo 5. Cloud Storageの古いファイルを完全に削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 6. トップレベルファイルを直接アップロード
gsutil -m cp dist\index.html gs://sharechat-media-bucket/frontend/
gsutil -m cp dist\vite.svg gs://sharechat-media-bucket/frontend/

echo 7. アセットディレクトリをフラット構造でアップロード
gsutil -m cp -r dist\assets\* gs://sharechat-media-bucket/frontend/assets/

echo 8. アクセス権限を設定
gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/**

echo 9. メタデータとCORSを設定
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:no-store" gs://sharechat-media-bucket/frontend/assets/*
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo 10. 認証URLテスト用のスクリプトを作成
echo "console.log('Testing authenticated access to assets...');" > auth-test.js
gsutil cp auth-test.js gs://sharechat-media-bucket/frontend/auth-test.js
del auth-test.js

echo "URLにアクセスして '?run=test' パラメータを追加してテストしてください" > test-instructions.txt
gsutil cp test-instructions.txt gs://sharechat-media-bucket/frontend/
del test-instructions.txt

echo デプロイ完了！
echo ブラウザのキャッシュをクリアして確認してください。
echo.
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
