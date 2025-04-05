// Cloud Run スタートアップスクリプト
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の出力
console.log('===== Cloud Run起動初期化 =====');
console.log('環境変数:');
console.log('NODE_ENV:', process.env.NODE_ENV || '未設定');
console.log('PORT:', process.env.PORT || '未設定');
console.log('GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID || '未設定');
console.log('GOOGLE_CLOUD_STORAGE_BUCKET:', process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '未設定');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '設定済み' : '未設定');

// 必要なディレクトリの作成
console.log('システムディレクトリの確認:');

// 一時アップロードディレクトリ
const tempUploadsDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempUploadsDir)) {
  console.log(`一時アップロードディレクトリを作成: ${tempUploadsDir}`);
  fs.mkdirSync(tempUploadsDir, { recursive: true });
} else {
  console.log(`一時アップロードディレクトリが存在: ${tempUploadsDir}`);
}

// データディレクトリ
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  console.log(`データディレクトリを作成: ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
} else {
  console.log(`データディレクトリが存在: ${dataDir}`);
}

console.log('初期化完了 - サーバー起動');
console.log('==========================');

// メインサーバープロセスを起動
import './server.js';
