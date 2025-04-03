@echo off
echo ShareChat index.htmlコピーツール
echo ==========================

echo 1. index.htmlを取得
gsutil cp gs://sharechat-media-bucket/frontend/index.html index.html

echo 2. index（拡張子なし）としてアップロード
gsutil cp index.html gs://sharechat-media-bucket/frontend/index
gsutil setmeta -h "Content-Type:text/html" gs://sharechat-media-bucket/frontend/index

echo 3. テンポラリファイルを削除
del index.html

echo indexファイル拡張子なしバージョンのコピー完了
