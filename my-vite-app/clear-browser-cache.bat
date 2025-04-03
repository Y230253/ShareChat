@echo off
echo ShareChat ブラウザキャッシュクリア手順
echo ============================

echo ブラウザキャッシュのクリア方法:
echo.
echo Chrome/Edge:
echo 1. Ctrl+Shift+Delete キーを押す
echo 2. 「キャッシュされた画像とファイル」にチェック
echo 3. 「データを削除」ボタンをクリック
echo 4. Ctrl+Shift+R でハードリフレッシュ
echo.
echo Firefox:
echo 1. Ctrl+Shift+Delete キーを押す
echo 2. 「Cookie」と「キャッシュ」にチェック
echo 3. 「今すぐ消去」ボタンをクリック
echo 4. Ctrl+F5 でハードリフレッシュ
echo.
echo ブラウザのシークレットウィンドウで開くと、キャッシュの影響を受けません。
echo.
echo エンターキーを押すとブラウザを開きます...
pause > nul

start https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
