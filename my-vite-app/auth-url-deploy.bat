@echo off
echo ShareChat 認証URL対応デプロイツール
echo ============================

echo 1. ビルド設定を確認
echo ファイルパス構造が認証URLで動作するか確認しています...

echo 2. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 3. 新規ビルド
call npm run build

echo 4. インデックスファイルを検査
type dist\index.html
echo.
echo ↑ アセットパスが相対パスになっていることを確認してください

echo 5. 古いファイルを削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 6. 新しいファイルをアップロード (フラットモード)
gsutil -m cp -r dist\* gs://sharechat-media-bucket/frontend/

echo 7. アセットディレクトリを正しく配置
gsutil -m cp -r dist\assets\* gs://sharechat-media-bucket/frontend/assets/

echo 8. メタデータ設定 (CORS対応)
gsutil setmeta -h "Content-Type:text/html" ^
               -h "Cache-Control:no-cache, no-store, must-revalidate" ^
               -h "Access-Control-Allow-Origin:*" ^
               gs://sharechat-media-bucket/frontend/index.html

gsutil -m setmeta -h "Access-Control-Allow-Origin:*" gs://sharechat-media-bucket/frontend/assets/*

echo 9. インデックスファイルの内容確認
gsutil cat gs://sharechat-media-bucket/frontend/index.html

echo 認証URL対応デプロイ完了！
echo.
echo 一般公開URL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo (認証URL経由でアクセスする場合も上記を使用)
