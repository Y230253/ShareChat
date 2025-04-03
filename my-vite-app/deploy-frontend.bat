REM filepath: c:\Users\2004a\Shacha\ShareChat\my-vite-app\deploy-frontend.bat
@echo off
echo ShareChat フロントエンドデプロイスクリプト
echo ====================================

echo 1. 環境変数と認証の確認...
echo Google Cloud認証状態:
call gcloud auth list
echo.

echo 2. フロントエンドをビルド中...
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo エラー: npmビルドに失敗しました。
  exit /b 1
)

if not exist "dist" (
  echo エラー: ビルドに失敗しました。dist フォルダが存在しません。
  exit /b 1
)
if not exist "dist\index.html" (
  echo エラー: ビルドに失敗しました。dist\index.html が存在しません。
  dir dist
  exit /b 1
)

echo ビルド完了！フォルダの内容を確認します:
dir dist
echo.

echo 3. バケットの存在確認...
echo バケット一覧を表示:
call gsutil ls
echo.
echo 対象バケット詳細:
call gsutil ls -L gs://sharechat-media-bucket
if %ERRORLEVEL% NEQ 0 (
  echo エラー: バケット「sharechat-media-bucket」が存在しないか、アクセス権限がありません。
  exit /b 1
)

echo 4. frontendディレクトリの確認と準備...
echo 現在のフロントエンドディレクトリの内容:
call gsutil ls -la gs://sharechat-media-bucket/frontend/
echo.

echo 5. 既存のファイルをクリア (必要な場合)...
echo 既存のindex.htmlを削除 (ない場合はエラー出力を無視):
call gsutil rm gs://sharechat-media-bucket/frontend/index.html >nul 2>&1
call gsutil rm -r gs://sharechat-media-bucket/frontend/assets >nul 2>&1
echo.

echo 6. フロントエンドファイルをアップロード中...
echo index.htmlをfrontend直下に配置:
call gsutil -v -h "Cache-Control:no-cache,max-age=0" cp dist\index.html gs://sharechat-media-bucket/frontend/index.html
if %ERRORLEVEL% NEQ 0 (
  echo エラー: index.htmlのアップロードに失敗しました。
  echo 詳細なエラー情報:
  call gsutil stat gs://sharechat-media-bucket/frontend/index.html
  exit /b 1
)

if exist "dist\assets" (
  echo アセットファイルをfrontend/assetsに配置:
  call gsutil -m cp -r dist\assets\* gs://sharechat-media-bucket/frontend/assets/
  if %ERRORLEVEL% NEQ 0 (
    echo 警告: 一部のアセットファイルのアップロードに失敗した可能性があります。
  )
)

echo その他のファイルをアップロード:
for %%F in (dist\*.js dist\*.css dist\*.svg dist\*.ico dist\*.png dist\*.jpg dist\*.json) do (
  if exist "%%F" (
    echo   %%F をアップロード中...
    call gsutil cp "%%F" gs://sharechat-media-bucket/frontend/
    if %ERRORLEVEL% NEQ 0 (
      echo 警告: %%Fのアップロードに失敗しましたが、処理を続行します。
    )
  )
)

echo 7. アップロード結果を確認中...
echo バケットの内容確認 (frontend ディレクトリ):
call gsutil ls -la gs://sharechat-media-bucket/frontend/
echo.

echo index.htmlの存在を確認:
call gsutil stat gs://sharechat-media-bucket/frontend/index.html
if %ERRORLEVEL% NEQ 0 (
  echo エラー: アップロード後もindex.htmlが見つかりません。
  echo アップロード処理に問題がある可能性があります。
  echo バケットの内容を確認:
  call gsutil ls gs://sharechat-media-bucket/frontend/
  exit /b 1
)

echo 8. バケット内のファイルを公開設定に変更...
call gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/
if %ERRORLEVEL% NEQ 0 (
  echo 警告: ファイルの公開設定に失敗しました。バケットのIAM設定を確認してください。
)

echo デプロイ完了！
echo ------------------------------------
echo フロントエンドは以下でアクセス可能です:
echo https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo.
echo アクセスしてエラーが出る場合は:
echo 1) バケットのIAM設定で公開アクセスを許可されているか確認
echo 2) ブラウザキャッシュをクリアしてみる
echo 3) 別のブラウザから試す
