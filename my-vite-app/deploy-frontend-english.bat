@echo off
echo ShareChat Frontend Deployment Script
echo ====================================

echo 1. Checking environment and authentication...
echo Google Cloud authentication status:
call gcloud auth list
echo.

REM Auth check
echo Verifying authentication...
gcloud config get-value account > nul
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Not authenticated with Google Cloud.
  echo Please run: gcloud auth login
  exit /b 1
)

echo 2. Building frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: npm build failed.
  exit /b 1
)

if not exist "dist" (
  echo ERROR: Build failed. dist folder does not exist.
  exit /b 1
)
if not exist "dist\index.html" (
  echo ERROR: Build failed. dist\index.html does not exist.
  dir dist
  exit /b 1
)

echo Build completed! Checking folder contents:
dir dist
echo.

echo 3. Verifying bucket existence...
echo Bucket list:
call gsutil ls
echo.
echo Target bucket details:
call gsutil ls -L gs://sharechat-media-bucket
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Bucket "sharechat-media-bucket" does not exist or no access permission.
  exit /b 1
)

echo 4. Checking and preparing frontend directory...
echo Current frontend directory contents:
call gsutil ls -la gs://sharechat-media-bucket/frontend/ 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Creating frontend directory...
  call gsutil cp NUL gs://sharechat-media-bucket/frontend/.keep
)
echo.

echo 5. Removing existing files (if needed)...
echo Removing existing index.html (ignore errors if not found):
call gsutil rm gs://sharechat-media-bucket/frontend/index.html >nul 2>&1
call gsutil rm -r gs://sharechat-media-bucket/frontend/assets >nul 2>&1
echo.

echo 6. Uploading frontend files...
echo Uploading index.html to frontend directory:
call gsutil -v -h "Cache-Control:no-cache,max-age=0" cp dist\index.html gs://sharechat-media-bucket/frontend/index.html
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Failed to upload index.html.
  echo Detailed error information:
  call gsutil stat gs://sharechat-media-bucket/frontend/index.html
  exit /b 1
)

if exist "dist\assets" (
  echo Uploading asset files to frontend/assets:
  call gsutil -m cp -r dist\assets\* gs://sharechat-media-bucket/frontend/assets/
  if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Some asset files may have failed to upload.
  )
)

echo Uploading other files:
for %%F in (dist\*.js dist\*.css dist\*.svg dist\*.ico dist\*.png dist\*.jpg dist\*.json) do (
  if exist "%%F" (
    echo   Uploading %%F...
    call gsutil cp "%%F" gs://sharechat-media-bucket/frontend/
    if %ERRORLEVEL% NEQ 0 (
      echo WARNING: Failed to upload %%F but continuing.
    )
  )
)

echo 7. Verifying uploaded files...
echo Checking bucket contents (frontend directory):
call gsutil ls -la gs://sharechat-media-bucket/frontend/
echo.

echo Verifying index.html existence:
call gsutil stat gs://sharechat-media-bucket/frontend/index.html
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: index.html not found after upload.
  echo There may be a problem with the upload process.
  echo Checking bucket contents:
  call gsutil ls gs://sharechat-media-bucket/frontend/
  exit /b 1
)

echo 8. Setting public access for bucket files...
call gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/
if %ERRORLEVEL% NEQ 0 (
  echo WARNING: Failed to set public access. Check bucket IAM settings.
)

echo Deployment completed!
echo ------------------------------------
echo Frontend is accessible at:
echo https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo.
echo If you encounter errors when accessing:
echo 1) Verify public access is allowed in bucket IAM settings
echo 2) Try clearing browser cache
echo 3) Try accessing from a different browser
