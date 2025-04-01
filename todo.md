Google Cloud での ShareChat アプリケーション デプロイ手順
1. Google Cloud 基本設定
Google Cloud アカウント作成と新規プロジェクト設定

Google Cloud Console (https://console.cloud.google.com/) にアクセス
新しいプロジェクトを作成（例: sharechat-app）
お支払い方法を設定（無料枠も利用可能）
必要なサービスの有効化

Cloud Run
Cloud Storage
Cloud Build
Cloud Logging
2. Cloud Storage 設定
バケット作成

Cloud Console で「Cloud Storage」→「バケットを作成」
バケット名を設定（例: sharechat-media）
リージョン選択（例: asia-northeast1 - 東京）
アクセス制御: 「均一」→ パブリック読み取りアクセス許可に設定
「作成」をクリック
バケット内にフォルダ構造を作成

uploads/ - アップロードファイル用
data/ - JSONファイル用
初期データファイルのアップロード

UserData.json と PhotoData.json を data/ フォルダにアップロード
3. アプリケーション コード修正
バックエンド修正

Google Cloud Storage クライアントライブラリ追加
環境変数対応
ファイルアップロード処理を修正
JSONファイル操作を Cloud Storage 対応に変更
ポート設定を環境変数から取得するよう修正
フロントエンド修正

API エンドポイントを環境変数から取得するよう設定
本番環境と開発環境の分離
4. 環境ファイルの作成
.env.development - 開発環境用
.env.production - 本番環境用
5. Dockerファイル作成
バックエンド用 Dockerfile
フロントエンド用 Dockerfile（もしくは静的ファイルとして Cloud Storage にデプロイ）
6. Google Cloud サービスアカウント設定
サービスアカウント作成

IAM & 管理 → サービスアカウント → 新しいサービスアカウト
必要な権限付与: Cloud Storage 管理者
認証キーファイル（JSON）をダウンロード

7. Cloud Run でバックエンドのデプロイ
Google Cloud SDK インストール（ローカルから操作する場合）

バックエンドのデプロイ

Cloud Build または gcloud コマンドを使用
環境変数の設定
8. フロントエンドのデプロイ
静的ウェブサイトとして Cloud Storage にデプロイ
または Cloud Run を使用
9. ドメイン設定（オプション）
カスタムドメインの設定
SSL証明書の設定
10. 監視とメンテナンス設定
Cloud Logging の設定
アラート設定
定期的なバックアップ設定
これらの手順を一つずつ詳細に実装していきましょう。最初にどの部分から始めたいですか？