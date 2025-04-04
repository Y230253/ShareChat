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
     - Artifact Registry API

2. **サービスアカウントの作成**
   - [IAMと管理] > [サービスアカウント] > [サービスアカウントを作成]
   - 名前: `sharechat-service-account`
   - 以下の権限を付与:
     - Cloud Storage 管理者
     - Cloud Run 管理者
     - Artifact Registry 管理者
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

## 5. Cloud Run へのデプロイ (Artifact Registry 使用)

1. **Google Cloud SDKのインストールと認証**
   - [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) をインストール
   - ターミナルを開き、以下を実行:
   ```bash
   gcloud auth login
   gcloud config set project sharechat-455513
   ```

2. **Artifact Registry の設定**
   - Artifact Registry APIを有効化:
   ```bash
   gcloud services enable artifactregistry.googleapis.com
   ```
   - Container Registryから移行する場合:
   ```bash
   gcloud artifacts docker upgrade migrate --projects='sharechat-455513'
   ```
   - または新しいリポジトリを作成:
   ```bash
   gcloud artifacts repositories create sharechat-repo \
       --repository-format=docker \
       --location=asia-northeast1 \
       --description="ShareChat Docker Repository"
   ```

3. **バックエンドを Cloud Run にデプロイ**
   ```bash
   # バックエンドディレクトリに移動
   cd backend
   
   # イメージをビルドしてArtifact Registryにプッシュ
   gcloud builds submit --tag asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend
   
   # Cloud Runにデプロイ
   gcloud run deploy sharechat-backend \
     --image asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend \
     --platform managed \
     --region asia-northeast1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT_ID=sharechat-455513,GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket,JWT_SECRET=nishichopass"
   ```
   gcloud run deploy sharechat-backend `
   --image asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend `
   --platform managed `
   --region asia-northeast1 `
   --allow-unauthenticated `

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

6. **デプロイ後のURLを取得して設定**
   ```bash
   # バックエンドのURLを取得
   gcloud run services describe sharechat-backend --platform managed --region asia-northeast1 --format="value(status.url)"
   ```
   - 取得したURLを `.env.production` ファイルの `VITE_API_URL` に設定

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

## 8. Git関連のトラブルシューティング

### Git コミットはできるがプッシュができない場合

1. **リモートリポジトリの設定を確認**
   ```bash
   git remote -v
   ```
   - 正しいURLが表示されているか確認
   - URLが間違っている場合は以下のコマンドで修正:
   ```bash
   git remote set-url origin [正しいURL]
   ```

2. **認証情報の問題**
   - **HTTPS接続の場合**:
     - ユーザー名とパスワード/トークンが正しいか確認
     - GitHubの場合、2021年8月以降はパスワードではなく個人アクセストークンが必要
     - 認証情報を更新:
     ```bash
     git config --global credential.helper store
     # 次回のプッシュ時に認証情報を入力
     ```

   - **SSH接続の場合**:
     - SSHキーが正しく設定されているか確認:
     ```bash
     ssh -T git@github.com  # GitHubの場合
     ```
     - SSHキーを生成して追加:
     ```bash
     ssh-keygen -t ed25519 -C "your_email@example.com"
     # 生成されたキーをGitHubなどのサービスに追加
     ```

3. **アクセス権限の確認**
   - リポジトリへの書き込み権限があるか確認
   - フォークしたリポジトリの場合、元のリポジトリではなく自分のフォークにプッシュしているか確認

4. **ネットワーク問題**
   - プロキシ環境にいる場合はプロキシ設定:
   ```bash
   git config --global http.proxy http://proxyserver:port
   ```
   - ファイアウォールがGitのポート（HTTPS:443、SSH:22）をブロックしていないか確認

5. **エラーメッセージの解析**
   - `git push -v origin main` でより詳細なエラー情報を表示
   - エラーメッセージに基づいて対処

6. **強制プッシュ（最終手段）**
   - ローカルとリモートの履歴が大きく異なる場合のみ使用:
   ```bash
   git push -f origin main
   ```
   - 注意: 共有リポジトリでは他の人の作業を上書きする可能性があります

7. **大容量ファイルの問題**
   - リポジトリサイズ制限を超えていないか確認
   - 大きなファイルは Git LFS の使用を検討

## トラブルシューティング

### プロジェクト権限エラー「Project not found or permission denied」

このエラーが発生する場合は、以下の手順で解決します：

1. **正しいプロジェクトIDを設定する**
   - GCP Console で確認したプロジェクトIDを使用します
   - プロジェクトID は `sharechat-app` ではなく `sharechat-455513` のようなIDである可能性があります
   ```bash
   gcloud config set project sharechat-455513
   ```

2. **アカウント認証を確認**
   - 現在のアカウント認証状況を確認
   ```bash
   gcloud auth list
   ```
   - 必要に応じて再認証
   ```bash
   gcloud auth login
   ```

3. **プロジェクト一覧を確認**
   ```bash
   gcloud projects list
   ```
   - 表示されたプロジェクト一覧から正しいプロジェクトIDを特定し使用

### Cloud Build で「Dockerfile required when specifying --tag」エラー

このエラーは、`--tag` オプションを使用する際にDockerfileが必要なことを示しています。

1. **Dockerfileを作成する**
   - バックエンドディレクトリに `Dockerfile` を作成します
   - 基本的な Node.js アプリケーション用のDockerfileを記述

2. **Cloud Build コマンドを修正**
   ```bash
   cd backend
   gcloud builds submit --tag gcr.io/sharechat-455513/sharechat-backend .
   ```
   - `.` を末尾に追加して、現在のディレクトリをビルドコンテキストとして指定
   - プロジェクトIDを `sharechat-app` から実際のID `sharechat-455513` に変更

3. **別のデプロイ方法を使用**
   - Dockerfile があるディレクトリで直接Cloud Runにデプロイする方法もあります
   ```bash
   gcloud run deploy sharechat-backend \
     --source . \
     --platform managed \
     --region asia-northeast1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket,JWT_SECRET=your_secret_key"
   ```
   - この方法では Google Cloud が自動的に Dockerfile を検出してビルドします

## Container Registry から Artifact Registry への移行

Container Registry は非推奨となり、2024年5月末に廃止される予定です。代わりに Artifact Registry を使用する必要があります。

1. **Artifact Registryへの移行**
   ```bash
   # Artifact Registry APIを有効化
   gcloud services enable artifactregistry.googleapis.com
   
   # 自動移行ツールを実行
   gcloud artifacts docker upgrade migrate --projects='sharechat-455513'
   ```

2. **移行後のイメージパス**
   - 古いパス: `gcr.io/sharechat-455513/sharechat-backend`
   - 新しいパス: `asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend`

3. **デプロイコマンドの更新**
   ```bash
   gcloud run deploy sharechat-backend \
     --image asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend \
     --platform managed \
     --region asia-northeast1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT_ID=sharechat-455513,GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket,JWT_SECRET=sharechat_app_secret_key_1234567890"
   ```