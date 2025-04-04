@echo off
echo ShareChat ハッシュルータデプロイツール
echo ============================

echo 1. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 2. 新規ビルド
call npm run build

echo 3. Cloud Storageにデプロイ前に古いファイルを削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 4. 新しいファイルをアップロード
gsutil -m cp -r dist/* gs://sharechat-media-bucket/frontend/

echo 5. パブリックアクセスを設定
gsutil -m acl ch -u AllUsers:R gs://sharechat-media-bucket/frontend/**

echo 6. キャッシュコントロール設定
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" gs://sharechat-media-bucket/frontend/assets/*

echo 7. CORSの設定を更新
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo デプロイ完了！ブラウザのキャッシュをクリアしてアクセスしてください。
echo.
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
