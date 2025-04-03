@echo off
echo index.htmlの存在を確認しています:
call gsutil stat gs://sharechat-media-bucket/frontend/index.html
if %ERRORLEVEL% NEQ 0 (
  echo エラー: アップロード後にindex.htmlが見つかりません。
  echo アップロードプロセスに問題がある可能性があります。
  echo バケット内容を確認しています:
  call gsutil ls gs://sharechat-media-bucket/frontend/
  exit /b 1
)

echo 8. バケットファイルの公開アクセスを設定しています...
call gsutil -m acl ch -r -u AllUsers:R gs://sharechat-media-bucket/frontend/
if %ERRORLEVEL% NEQ 0 (
  echo 警告: 公開アクセスの設定に失敗しました。バケットIAM設定を確認してください。
)

echo デプロイが完了しました！
echo ------------------------------------
echo フロントエンドは以下でアクセス可能です:
echo https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo.
echo アクセス時にエラーが発生した場合:
echo 1) バケットIAM設定で公開アクセスが許可されていることを確認してください
echo 2) ブラウザのキャッシュをクリアしてみてください
echo 3) 別のブラウザからアクセスしてみてください
