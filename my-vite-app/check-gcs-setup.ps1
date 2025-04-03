# ShareChat Google Cloud Storage 設定確認ツール
Write-Host "ShareChat Google Cloud Storage Configuration Check Tool" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

Write-Host "1. Google Cloud Authentication Information" -ForegroundColor Cyan
Write-Host "----------------------------------" -ForegroundColor Cyan
gcloud auth list
Write-Host ""

Write-Host "2. Default Project Configuration" -ForegroundColor Cyan
Write-Host "-----------------------------" -ForegroundColor Cyan
gcloud config list project
Write-Host ""

Write-Host "3. Bucket List" -ForegroundColor Cyan
Write-Host "------------" -ForegroundColor Cyan
gsutil ls
Write-Host ""

Write-Host "4. Bucket Details" -ForegroundColor Cyan
Write-Host "---------------" -ForegroundColor Cyan
try {
    gsutil ls -L gs://sharechat-media-bucket
} catch {
    Write-Host "Error: Cannot access bucket 'sharechat-media-bucket'" -ForegroundColor Red
}
Write-Host ""

Write-Host "5. Folder Structure in Bucket" -ForegroundColor Cyan
Write-Host "-------------------------" -ForegroundColor Cyan
Write-Host "Frontend directory:"
try {
    gsutil ls gs://sharechat-media-bucket/frontend/
} catch {
    Write-Host "  No frontend directory found or no access permission" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Upload directory:"
try {
    gsutil ls gs://sharechat-media-bucket/uploads/
} catch {
    Write-Host "  No uploads directory found or no access permission" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Data directory:"
try {
    gsutil ls gs://sharechat-media-bucket/data/
} catch {
    Write-Host "  No data directory found or no access permission" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "6. Permission Test" -ForegroundColor Cyan
Write-Host "------------------" -ForegroundColor Cyan
Write-Host "(1) Test file creation:"
"Test content" | Out-File -Encoding utf8 test.txt
try {
    gsutil cp test.txt gs://sharechat-media-bucket/test.txt
    Write-Host "  Upload to bucket: Success" -ForegroundColor Green
    gsutil rm gs://sharechat-media-bucket/test.txt
    Write-Host "  Test file deletion: Complete" -ForegroundColor Green
} catch {
    Write-Host "  Error: No write permission to bucket" -ForegroundColor Red
}

Write-Host "(2) Frontend directory test:"
try {
    gsutil cp test.txt gs://sharechat-media-bucket/frontend/test.txt
    Write-Host "  Upload to frontend directory: Success" -ForegroundColor Green
    gsutil rm gs://sharechat-media-bucket/frontend/test.txt
    Write-Host "  Test file deletion: Complete" -ForegroundColor Green
} catch {
    Write-Host "  Error: No write permission to frontend directory" -ForegroundColor Red
}
Remove-Item test.txt

Write-Host ""
Write-Host "Diagnosis Complete" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host "If issues persist, check:" -ForegroundColor Yellow
Write-Host "1. Bucket settings directly in Google Cloud Console"
Write-Host "2. Correct IAM permissions"
Write-Host "3. Default access settings for the bucket"
Write-Host "4. Service account permissions"

# 認証問題のトラブルシューティング情報
Write-Host ""
Write-Host "Authentication Troubleshooting" -ForegroundColor Magenta
Write-Host "============================" -ForegroundColor Magenta
Write-Host "Current authenticated account: $(gcloud config get-value account)"
Write-Host "Checking application default credentials:" 
gcloud auth application-default print-access-token 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Application default credentials not set. Try running:" -ForegroundColor Yellow
    Write-Host "  gcloud auth application-default login" -ForegroundColor Cyan
}

# 実際のバケット設定状態を出力
Write-Host ""
Write-Host "Current bucket website configuration:" -ForegroundColor Cyan
try {
    gsutil web get gs://sharechat-media-bucket
} catch {
    Write-Host "  Cannot retrieve website configuration" -ForegroundColor Yellow
}
