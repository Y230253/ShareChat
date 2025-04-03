#!/bin/bash
echo "ShareChat SPA ルーティング設定スクリプト"
echo "========================================"

# エラーハンドリング
set -e

# バケット名
BUCKET="sharechat-media-bucket"
FRONTEND_DIR="frontend"

echo "1. frontend/index.htmlをNotFoundエラー用の404ページとして設定"
cat > error.html <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;URL='/frontend/index.html'">
</head>
<body>
  リダイレクト中...
</body>
</html>
EOF

# 404エラーページをアップロード
gsutil cp error.html gs://$BUCKET/error.html

# バケットのウェブサイト設定を構成
cat > website-config.json <<EOF
{
  "notFoundPage": "error.html",
  "mainPageSuffix": "frontend/index.html"
}
EOF

echo "2. バケットをウェブサイトとして設定"
gsutil web set -m frontend/index.html -e error.html gs://$BUCKET

echo "3. すべてのファイルのパブリックアクセスを確保"
gsutil -m acl ch -r -u AllUsers:R gs://$BUCKET/$FRONTEND_DIR/

echo "セットアップ完了"
echo "注意: Cloud Storage バケットの静的ウェブサイトホスティングは、"
echo "SPAのクライアントサイドルーティングを完全にサポートしていない場合があります。"
echo "本格的なプロダクション環境では Firebase Hosting または"
echo "Google Cloud Load Balancer と Cloud CDN の使用を検討してください。"
