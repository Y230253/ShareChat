@echo off
echo ShareChat CORS問題修正デプロイツール
echo ===============================

echo 1. 環境変数の確認
echo 本番APIエンドポイント:
type .env.production
echo.

echo 2. ビルド前のクリーンアップ
rmdir /S /Q dist
mkdir dist

echo 3. 本番環境用にビルド
echo NODE_ENV=production > .env.local
call npm run build -- --mode production

echo 4. vite.svgを確実に含める
copy public\vite.svg dist\vite.svg
if %ERRORLEVEL% NEQ 0 (
  echo SVGファイルのコピーに失敗しました。public\vite.svgが存在するか確認してください。
  mkdir public 2>nul
  echo ^<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"^>^<rect width="32" height="32" fill="%2342b983"/^>^<text x="50%%" y="50%%" text-anchor="middle" dy=".3em" fill="white" font-family="Arial" font-size="16"^>SC^</text^>^</svg^> > dist\vite.svg
  echo 代替SVGを作成しました
)

echo 5. Cloud Storageの古いファイルを完全に削除
gsutil -m rm -rf gs://sharechat-media-bucket/frontend/**

echo 6. 新しいファイルをアップロード
gsutil -m cp -r dist\* gs://sharechat-media-bucket/frontend/

echo 7. アクセス権限の明示的設定
gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/

echo 8. キャッシュコントロール設定
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/index.html
gsutil -m setmeta -h "Cache-Control:no-cache, max-age=0" gs://sharechat-media-bucket/frontend/vite.svg
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://sharechat-media-bucket/frontend/assets/*

echo 9. CORS設定の更新
gsutil cors set cors-config.json gs://sharechat-media-bucket

echo 10. ファイルの存在を確認
gsutil ls gs://sharechat-media-bucket/frontend/vite.svg
gsutil ls gs://sharechat-media-bucket/frontend/index.html
gsutil ls gs://sharechat-media-bucket/frontend/assets/

echo デプロイ完了！ブラウザのキャッシュをクリアして確認してください。
echo パブリックURL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
