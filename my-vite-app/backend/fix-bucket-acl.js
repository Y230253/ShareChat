import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 設定
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'sharechat-455513';
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'sharechat-media-bucket';

console.log(`ShareChat バケットアクセス修正ツール`);
console.log(`プロジェクト: ${projectId}`);
console.log(`バケット: ${bucketName}`);

// Cloud Storage初期化
const storage = new Storage({
  projectId,
  keyFilename: path.join(__dirname, 'gcp-key.json')
});

const bucket = storage.bucket(bucketName);

async function fixBucketAccess() {
  try {
    console.log('バケット情報確認中...');
    const [metadata] = await bucket.getMetadata();
    console.log(`バケット名: ${metadata.name}`);
    console.log(`作成日: ${metadata.timeCreated}`);
    console.log(`ストレージクラス: ${metadata.storageClass}`);

    // 現在の統一バケットレベルアクセス設定を確認
    console.log('統一バケットレベルアクセス設定の確認...');
    const [uniformBucketLevelAccess] = await bucket.getMetadata({
      fields: 'iamConfiguration'
    });

    const isUniformEnabled = 
      uniformBucketLevelAccess.iamConfiguration?.uniformBucketLevelAccess?.enabled;
    
    console.log(`統一バケットレベルアクセス: ${isUniformEnabled ? '有効' : '無効'}`);

    // 統一バケットレベルアクセスを有効に
    if (!isUniformEnabled) {
      console.log('統一バケットレベルアクセスを有効化...');
      await bucket.setMetadata({
        iamConfiguration: {
          uniformBucketLevelAccess: {
            enabled: true
          }
        }
      });
      console.log('有効化完了');
    }

    // バケットに公開アクセス権を設定
    console.log('パブリックアクセスポリシーを設定...');
    await bucket.iam.setPolicy({
      bindings: [
        {
          role: 'roles/storage.objectViewer',
          members: ['allUsers']
        }
      ]
    });
    console.log('パブリックアクセス設定完了');

    // CORSポリシーの設定
    console.log('CORSポリシーを設定...');
    await bucket.setCorsConfiguration([
      {
        origin: ['*'],
        method: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        responseHeader: [
          'Content-Type', 'Content-Length', 'Authorization', 
          'Content-Range', 'Range', 'Access-Control-Allow-Origin'
        ],
        maxAgeSeconds: 3600
      }
    ]);
    console.log('CORSポリシー設定完了');

    console.log('バケット設定の修正が完了しました');
    console.log('アップロードエラーが解消されるはずです');

  } catch (error) {
    console.error('バケット設定エラー:', error);
  }
}

// スクリプト実行
fixBucketAccess();
