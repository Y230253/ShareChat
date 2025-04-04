import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の読み込み（dotenvを使う場合）
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'sharechat-455513';
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'sharechat-media-bucket';

console.log(`Google Cloud Storage初期化スクリプト`);
console.log(`プロジェクトID: ${projectId}`);
console.log(`バケット名: ${bucketName}`);

// Storage初期化
const storage = new Storage({
  projectId,
  keyFilename: path.join(__dirname, 'gcp-key.json')
});

const bucket = storage.bucket(bucketName);

// データファイルパス
const dataFilePath = 'data/PhotoData.json';
const userDataFilePath = 'data/UserData.json';

// 初期データ構造
const initialPhotoData = {
  users: [],
  posts: [],
  likes: [],
  bookmarks: [],
  comments: [],
  tags: []
};

const initialUserData = {
  users: []
};

// データファイル存在確認・作成
async function initializeStorage() {
  try {
    console.log('バケットアクセス確認中...');
    const [exists] = await bucket.exists();
    
    if (!exists) {
      console.error(`エラー: バケット '${bucketName}' が存在しません`);
      console.log('バケットを作成します...');
      await storage.createBucket(bucketName, {
        location: 'asia-northeast1',
        storageClass: 'STANDARD'
      });
      console.log(`バケット '${bucketName}' を作成しました`);
    } else {
      console.log(`バケット '${bucketName}' が存在することを確認しました`);
    }

    // データディレクトリの作成
    console.log('データディレクトリの確認...');
    const dataDir = bucket.file('data/');
    const [dataDirExists] = await dataDir.exists();

    if (!dataDirExists) {
      console.log('データディレクトリを作成します...');
      await bucket.file('data/.keep').save('');
      console.log('データディレクトリを作成しました');
    }

    // アップロードディレクトリの作成
    console.log('アップロードディレクトリの確認...');
    const uploadsDir = bucket.file('uploads/');
    const [uploadsDirExists] = await uploadsDir.exists();

    if (!uploadsDirExists) {
      console.log('アップロードディレクトリを作成します...');
      await bucket.file('uploads/.keep').save('');
      console.log('アップロードディレクトリを作成しました');
    }
    
    // PhotoData.jsonの確認・作成
    console.log('PhotoData.jsonの確認...');
    const dataFile = bucket.file(dataFilePath);
    const [dataFileExists] = await dataFile.exists();
    
    if (!dataFileExists) {
      console.log('PhotoData.jsonを作成しています...');
      await dataFile.save(JSON.stringify(initialPhotoData, null, 2), {
        contentType: 'application/json'
      });
      console.log('PhotoData.jsonを作成しました');
    } else {
      console.log('PhotoData.jsonは既に存在します');
    }
    
    // UserData.jsonの確認・作成
    console.log('UserData.jsonの確認...');
    const userDataFile = bucket.file(userDataFilePath);
    const [userDataFileExists] = await userDataFile.exists();
    
    if (!userDataFileExists) {
      console.log('UserData.jsonを作成しています...');
      await userDataFile.save(JSON.stringify(initialUserData, null, 2), {
        contentType: 'application/json'
      });
      console.log('UserData.jsonを作成しました');
    } else {
      console.log('UserData.jsonは既に存在します');
    }
    
    console.log('初期化完了！');
  } catch (error) {
    console.error('初期化エラー:', error);
    process.exit(1);
  }
}

// 実行
initializeStorage();
