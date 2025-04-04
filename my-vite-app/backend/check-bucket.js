import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の読み込み
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'sharechat-455513';
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'sharechat-media-bucket';

console.log(`Google Cloud Storage バケット確認スクリプト`);
console.log(`プロジェクトID: ${projectId}`);
console.log(`バケット名: ${bucketName}`);

// Storage初期化
const storage = new Storage({
  projectId,
  keyFilename: path.join(__dirname, 'gcp-key.json')
});

// バケット存在確認と作成
async function checkAndCreateBucket() {
  try {
    console.log(`バケット '${bucketName}' の存在を確認中...`);
    const [buckets] = await storage.getBuckets();
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`バケット '${bucketName}' は存在しません。作成します...`);
      await storage.createBucket(bucketName, {
        location: 'asia-northeast1',
        storageClass: 'STANDARD'
      });
      console.log(`バケット '${bucketName}' を作成しました！`);
      
      // 公開アクセス設定
      await storage.bucket(bucketName).iam.setPolicy({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['allUsers']
          }
        ]
      });
      console.log(`バケットを公開アクセス可能に設定しました`);
    } else {
      console.log(`バケット '${bucketName}' は既に存在しています`);
    }
    
    console.log('バケット確認完了');
  } catch (error) {
    console.error('バケット確認/作成エラー:', error);
    process.exit(1);
  }
}

// 実行
checkAndCreateBucket();
