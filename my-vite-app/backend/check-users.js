import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の読み込み
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'sharechat-455513';
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'sharechat-media-bucket';

console.log(`ShareChat ユーザーデータ確認ユーティリティ`);
console.log(`プロジェクトID: ${projectId}`);
console.log(`バケット名: ${bucketName}`);

// Storage初期化
const storage = new Storage({
  projectId,
  keyFilename: path.join(__dirname, 'gcp-key.json')
});

const bucket = storage.bucket(bucketName);
const userDataPath = 'data/UserData.json';

async function checkUsers() {
  try {
    console.log(`バケット '${bucketName}' からユーザーデータ読み込み中...`);
    
    const file = bucket.file(userDataPath);
    const [exists] = await file.exists();
    
    if (!exists) {
      console.error(`エラー: ファイル ${userDataPath} が存在しません`);
      process.exit(1);
    }
    
    console.log(`ファイル ${userDataPath} が見つかりました、読み込み中...`);
    const [content] = await file.download();
    const contentString = content.toString();
    
    try {
      const userData = JSON.parse(contentString);
      
      if (!userData.users || !Array.isArray(userData.users)) {
        console.error('エラー: ユーザーデータの形式が正しくありません');
        console.log('データ構造:', userData);
        process.exit(1);
      }
      
      console.log(`ユーザーデータ読み込み完了、${userData.users.length}件のユーザーが存在します`);
      
      if (userData.users.length === 0) {
        console.log('ユーザーが登録されていません。テストユーザーを作成しますか？ (Y/n)');
        process.stdin.once('data', async (data) => {
          const input = data.toString().trim().toLowerCase();
          if (input === 'y' || input === '') {
            await createTestUser(userData);
          } else {
            console.log('テストユーザー作成をスキップしました');
            process.exit(0);
          }
        });
      } else {
        console.log('\n登録済みユーザー一覧:');
        userData.users.forEach((user, index) => {
          console.log(`[${index + 1}] ID: ${user.id}, ユーザー名: ${user.username}, メールアドレス: ${user.email}`);
        });
        
        console.log('\nテストログイン情報:');
        console.log(`メールアドレス: ${userData.users[0].email}`);
        console.log('パスワード: (ハッシュ化されているため表示できません)');
        
        process.exit(0);
      }
      
    } catch (parseError) {
      console.error('エラー: JSONのパースに失敗しました', parseError);
      console.log('ファイル内容の先頭部分:', contentString.substring(0, 200));
      process.exit(1);
    }
    
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

async function createTestUser(userData) {
  try {
    const testUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
      icon_url: null
    };
    
    userData.users.push(testUser);
    
    const file = bucket.file(userDataPath);
    await file.save(JSON.stringify(userData, null, 2), {
      contentType: 'application/json'
    });
    
    console.log('テストユーザーを作成しました:');
    console.log('メールアドレス: test@example.com');
    console.log('パスワード: password123');
    
    process.exit(0);
  } catch (error) {
    console.error('テストユーザー作成エラー:', error);
    process.exit(1);
  }
}

// 実行
checkUsers();
