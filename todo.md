# Google Cloud へのShareChatデプロイ手順

## 1. Google Cloud 環境の準備

1. **Google Cloudアカウントの作成と設定**
   - Google Cloudアカウントを作成 (既にある場合はスキップ)
   - 新しいプロジェクトを作成: `sharechat-app`
   - 支払い方法を設定 (無料枠を使用する場合も必要)
   - APIとサービスで以下を有効化:
     - Cloud Run API
     - Cloud Storage API
     - Cloud Build API

2. **サービスアカウントの作成**
   - [IAMと管理] > [サービスアカウント] > [サービスアカウントを作成]
   - 名前: `sharechat-service-account`
   - 以下の権限を付与:
     - Cloud Storage 管理者
     - Cloud Run 管理者
   - キーを作成 (JSON形式) してダウンロード
   - ダウンロードしたキーを `gcp-key.json` としてバックエンドフォルダに保存

## 2. Cloud Storage の設定
test
1. **メディア用バケットの作成**
   - [Cloud Storage] > [バケットを作成]
   - 一意の名前を付ける: `sharechat-media-bucket`
   - リージョン選択: `asia-northeast1` (東京)
   - アクセス制御: 「均一」を選択
   - [公開アクセス防止] を無効化
   - バケットを作成

2. **バケットのアクセス権設定**
   - 作成したバケットを選択 > [権限] タブ
   - [メンバーを追加] > 「allUsers」を入力
   - [Cloud Storage] > [Storage Object Viewer] 役割を選択
   - [保存] をクリック (メディアファイルを公開アクセス可能に)

3. **フォルダ構造の作成**
   - `uploads/` フォルダを作成 (メディアファイル用)
   - `data/` フォルダを作成 (JSONデータ用)

4. **初期データファイルのアップロード**
   - データフォルダ内に以下のファイルを作成またはアップロード:
     - `UserData.json` (空の場合: `{"users":[]}`)
     - `PhotoData.json` (空の場合: `{"users":[],"posts":[],"likes":[],"bookmarks":[],"comments":[],"tags":[]}`)

## 3. バックエンドの準備

1. **必要なパッケージのインストール**
   ```bash
   cd my-vite-app
   npm install @google-cloud/storage dotenv
   ```

2. **環境変数ファイルの作成 (.envファイル)**
   ```bash
   touch backend/.env
   ```
   
   内容を以下のように設定:
   ```
   PORT=8080
   NODE_ENV=production
   GOOGLE_CLOUD_PROJECT_ID=sharechat-app
   GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket
   JWT_SECRET=あなたの独自のJWTシークレット
   ```

3. **server.js の修正**
   - @google-cloud/storage パッケージをインポート
   - 環境変数の読み込み処理を追加
   - ファイル保存先をCloud Storageに変更
   - JSONデータの読み書きをCloud Storage対応に変更
   - ポート設定を環境変数から取得するように変更

## 4. フロントエンドの準備

1. **環境変数ファイルを作成**
   - `.env.production` ファイルに以下を設定:
   ```
   VITE_API_URL=https://your-cloud-run-url.a.run.app
   ```

2. **フロントエンドをビルド**
   ```bash
   cd my-vite-app
   npm run build
   ```

## 5. Cloud Run へのデプロイ

1. **Google Cloud SDKのインストールと認証**
   - [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) をインストール
   - ターミナルを開き、以下を実行:
   ```bash
   gcloud auth login
   gcloud config set project sharechat-app
   ```

2. **app.yaml ファイルの作成**
   ```yaml
   runtime: nodejs16
   env: standard
   instance_class: F2

   env_variables:
     NODE_ENV: "production"
     GOOGLE_CLOUD_PROJECT_ID: "sharechat-app"
     GOOGLE_CLOUD_STORAGE_BUCKET: "sharechat-media-bucket"
     JWT_SECRET: "あなたの独自のJWTシークレット"

   handlers:
   - url: /.*
     secure: always
     redirect_http_response_code: 301
     script: auto
   ```

3. **バックエンドを Cloud Run にデプロイ**
   ```bash
   cd backend
   gcloud builds submit --tag gcr.io/sharechat-app/sharechat-backend
   gcloud run deploy sharechat-backend \
     --image gcr.io/sharechat-app/sharechat-backend \
     --platform managed \
     --region asia-northeast1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket,JWT_SECRET=あなたの独自のJWTシークレット"
   ```

4. **フロントエンドを Cloud Storage にデプロイ**
   ```bash
   cd ../dist  # ビルドされたフロントエンドファイル
   gsutil rsync -r . gs://sharechat-media-bucket/frontend
   gsutil web set -m index.html gs://sharechat-media-bucket/frontend
   ```

5. **フロントエンドの公開設定**
   ```bash
   gsutil iam ch allUsers:objectViewer gs://sharechat-media-bucket/frontend
   ```

## 6. ドメインとCDN設定 (オプション)

1. **Cloud CDN の設定**
   - Cloud Load Balancing で負荷分散器を作成
   - バックエンドに Cloud Run サービスを指定
   - Cloud CDN を有効化

2. **カスタムドメインの設定 (お持ちの場合)**
   - ドメインを Cloud Run サービスにマッピング
   - SSL 証明書の設定

## 7. 動作確認とメンテナンス

1. **アプリケーションの動作確認**
   - ブラウザで公開URLにアクセス
   - ユーザー登録、画像アップロード、投稿などの基本機能をテスト

2. **モニタリング設定**
   - Cloud Monitoring でアラートを設定
   - ログ監視を設定

3. **定期的なバックアップ設定**
   - Cloud Scheduler で定期的にデータのバックアップジョブを設定