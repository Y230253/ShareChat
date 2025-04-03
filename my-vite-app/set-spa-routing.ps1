# ShareChat SPA ルーティング設定スクリプト
Write-Host "ShareChat SPA Routing Configuration Script" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

# バケット名
$BUCKET = "sharechat-media-bucket"
$FRONTEND_DIR = "frontend"

Write-Host "1. Creating 404 error page for SPA routing" -ForegroundColor Cyan
@"
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;URL='/frontend/index.html'">
</head>
<body>
  Redirecting...
</body>
</html>
"@ | Out-File -Encoding utf8 error.html

# 404エラーページをアップロード
Write-Host "   Uploading error page..."
gsutil cp error.html gs://$BUCKET/error.html

# ウェブサイト設定ファイル作成
@"
{
  "notFoundPage": "error.html",
  "mainPageSuffix": "frontend/index.html"
}
"@ | Out-File -Encoding utf8 website-config.json

Write-Host "2. Setting bucket as website" -ForegroundColor Cyan
gsutil web set -m frontend/index.html -e error.html gs://$BUCKET

Write-Host "3. Making all files publicly accessible" -ForegroundColor Cyan
gsutil -m acl ch -r -u AllUsers:R gs://$BUCKET/$FRONTEND_DIR/

# 認証チェック
Write-Host "4. Verifying configuration" -ForegroundColor Cyan
Write-Host "   Checking bucket website settings:"
gsutil web get gs://$BUCKET

Write-Host "   Checking frontend directory access:"
gsutil ls -la gs://$BUCKET/$FRONTEND_DIR/

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Note: Cloud Storage static website hosting may not fully support" -ForegroundColor Yellow
Write-Host "client-side routing for SPAs. For production environments,"
Write-Host "consider Firebase Hosting or Google Cloud Load Balancer with Cloud CDN."

Remove-Item error.html
Remove-Item website-config.json
