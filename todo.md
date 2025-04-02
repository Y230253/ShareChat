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

1. **メディア用バケットの作成**
   - Google Cloud Console (https://console.cloud.google.com/) にログイン
   - 左側のナビゲーションメニューから「Cloud Storage」 > 「ブラウザ」をクリック
   - 上部の「バケットを作成」ボタンをクリック
   - バケット名を入力: `sharechat-media-bucket` (または他の一意の名前、世界中で唯一である必要があります)
   - 「ロケーションタイプ」で「リージョン」を選択、「asia-northeast1」(東京)を選びます
   - 「ストレージクラス」はデフォルト「Standard」のまま
   - 「アクセス制御」で「均一」を選択（これにより、バケット内のすべてのオブジェクトに同じアクセス設定が適用されます）
   - 「公開アクセスの防止」のチェックを外す（これにより、後で公開アクセスを許可できます）
   - 「作成」をクリックしてバケットを作成

2. **バケットのアクセス権設定 (メディアファイルを公開アクセス可能にする)**
   - 作成したバケット名をクリックして開く
   - 「権限」タブをクリック
   - 「メンバーを追加」ボタンをクリック
   - 「新しいプリンシパル」欄に「allUsers」と入力（これは「インターネット上のすべてのユーザー」を意味します）
   - 「ロールを選択」で「Cloud Storage」カテゴリー > 「Storage オブジェクト閲覧者」を選択
   （これにより、バケット内のファイルがインターネット上で公開されます）
   - 「保存」をクリックして権限を適用
   - 警告が表示される場合は「確認」をクリックして続行

3. **フォルダ構造の作成**
   - 注意: Cloud Storageの「フォルダ」は実際にはプレフィックスを持つオブジェクトのグループです
   - バケットの詳細画面で「オブジェクト」タブを選択
   - 「フォルダを作成」ボタンをクリック
   - フォルダ名「uploads」を入力し「作成」をクリック
   - 同様の手順で「data」フォルダも作成
   
   またはgsutilコマンドでの作成方法（Cloud Shell または Google Cloud SDKがインストールされた環境で）：
   ```bash
   # 空のファイルを作成してフォルダ構造を表現
   gsutil cp /dev/null gs://sharechat-media-bucket/uploads/
   gsutil cp /dev/null gs://sharechat-media-bucket/data/
   ```

4. **初期データファイルのアップロード**
   
   **ウェブコンソールでのアップロード:**
   - 「data」フォルダをクリックして開く
   - 「アップロード」ボタンをクリック
   - ローカルに作成したJSONファイルを選択するか、以下の手順で新規ファイルを作成：
   
   **空のデータファイルをローカルで作成する場合:**
   - テキストエディタで新規ファイル「UserData.json」を作成し、内容を入力:
     ```json
     {"users":[]}
     ```
   - 同様に「PhotoData.json」ファイルを作成:
     ```json
     {"users":[],"posts":[],"likes":[],"bookmarks":[],"comments":[],"tags":[]}
     ```
   - これらのファイルをCloud Storageにアップロード
   
   **gsutilコマンドでのアップロード:**
   ```bash
   # ローカルでJSONファイルを作成
   echo '{"users":[]}' > UserData.json
   echo '{"users":[],"posts":[],"likes":[],"bookmarks":[],"comments":[],"tags":[]}' > PhotoData.json
   
   # Cloud Storageにアップロード
   gsutil cp UserData.json gs://sharechat-media-bucket/data/
   gsutil cp PhotoData.json gs://sharechat-media-bucket/data/
   ```

5. **アップロード確認とアクセスURL**
   - アップロードしたファイルをクリックすると詳細が表示されます
   - 「公開URL」リンクをコピーして、ブラウザで開き、ファイルが公開アクセス可能か確認
   - メディアファイル用の基本URLは次のような形式になります：
     `https://storage.googleapis.com/sharechat-media-bucket/uploads/`
   - JSONデータファイル用の基本URLは次のようになります：
     `https://storage.googleapis.com/sharechat-media-bucket/data/`

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