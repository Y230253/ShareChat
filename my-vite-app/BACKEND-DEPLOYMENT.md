# ShareChat バックエンドデプロイガイド

このガイドでは、ShareChatアプリケーションのバックエンドをGoogle Cloudにデプロイする手順を説明します。

## 前提条件

1. Google Cloud SDKがインストールされていること
2. Google Cloudアカウントとプロジェクトが設定済みであること
3. Node.jsとnpmがインストールされていること

## Google Cloudでの事前設定

### 1. サービスアカウントキーの作成

1. Google Cloud コンソール (https://console.cloud.google.com) にアクセス
2. プロジェクトを選択
3. メニューから「IAMと管理」→「サービスアカウント」を選択
4. 「サービスアカウントを作成」をクリック
   - 名前: `sharechat-backend-sa`
   - 説明: `ShareChat Backend Service Account`
5. 「作成と続行」をクリック
6. 以下の役割を付与:
   - Cloud Storage管理者
   - Cloud Run管理者
7. 「完了」をクリック
8. 作成したサービスアカウントのメニューから「鍵を管理」を選択
9. 「鍵を追加」→「新しい鍵を作成」→「JSON」→「作成」
10. ダウンロードしたJSONファイルを `backend/gcp-key.json` として保存

### 2. Artifact Registryリポジトリの作成

```
gcloud artifacts repositories create sharechat-repo \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="ShareChat repository"
```

### 3. Cloud Storageバケットの確認

```
gsutil ls
```

バケット `sharechat-media-bucket` が表示されない場合は作成:

```
gsutil mb -l asia-northeast1 gs://sharechat-media-bucket
```

## デプロイ方法

### オプション1: デプロイスクリプトを使用する (推奨)

1. コマンドプロンプトを管理者として実行
2. プロジェクトのbackendディレクトリに移動:
   ```
   cd c:\Users\2004a\Shacha\ShareChat\my-vite-app\backend
   ```
3. デプロイスクリプトを実行:
   ```
   deploy-cloud-run.bat
   ```

### オプション2: 手動でデプロイする

1. コマンドプロンプトを管理者として実行
2. プロジェクトのbackendディレクトリに移動:
   ```
   cd c:\Users\2004a\Shacha\ShareChat\my-vite-app\backend
   ```
3. コンテナイメージをビルドしてアップロード:
   ```
   gcloud builds submit --tag asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend
   ```
4. Cloud Runにデプロイ:
   ```
   gcloud run deploy sharechat-backend 
     --image asia-northeast1-docker.pkg.dev/sharechat-455513/sharechat-repo/sharechat-backend 
     --platform managed 
     --region asia-northeast1 
     --allow-unauthenticated 
     --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT_ID=sharechat-455513,GOOGLE_CLOUD_STORAGE_BUCKET=sharechat-media-bucket,JWT_SECRET=nishichopass"
   ```

## デプロイ後の確認

1. デプロイされたURLにアクセスして動作確認:
   ```
   gcloud run services describe sharechat-backend --platform managed --region asia-northeast1 --format="value(status.url)"
   ```

2. フロントエンドの環境変数を更新:
   - `my-vite-app/.env.production` ファイルを開いて、`VITE_API_BASE_URL` をデプロイされたURLに更新

## トラブルシューティング

### ログの確認

```
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sharechat-backend" --limit=20
```

### 認証エラーが発生する場合

```
gcloud auth login
gcloud auth application-default login
```

### Cloud Run権限エラー

```
gcloud projects add-iam-policy-binding sharechat-455513 \
  --member="serviceAccount:sharechat-backend-sa@sharechat-455513.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```
