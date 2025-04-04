import fetch from 'node-fetch';
import readline from 'readline';

// コマンドライン入力用インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// デフォルトURL
const DEFAULT_API_URL = 'https://sharechat-backend-1047875971594.asia-northeast1.run.app';

// ログイン処理をテスト
async function testLogin() {
  try {
    // APIエンドポイントの入力
    const apiUrl = await new Promise((resolve) => {
      rl.question(`APIエンドポイントURL [${DEFAULT_API_URL}]: `, (answer) => {
        resolve(answer.trim() || DEFAULT_API_URL);
      });
    });
    
    // メールアドレスの入力
    const email = await new Promise((resolve) => {
      rl.question('メールアドレス: ', (answer) => {
        resolve(answer.trim());
      });
    });
    
    if (!email) {
      console.error('メールアドレスは必須です');
      rl.close();
      return;
    }
    
    // パスワードの入力
    const password = await new Promise((resolve) => {
      rl.question('パスワード: ', (answer) => {
        resolve(answer.trim());
      });
    });
    
    if (!password) {
      console.error('パスワードは必須です');
      rl.close();
      return;
    }
    
    // 認証エンドポイントの選択
    const endpoint = await new Promise((resolve) => {
      rl.question('エンドポイント [1=/auth/login, 2=/login]: ', (answer) => {
        if (answer === '2') return resolve('/login');
        return resolve('/auth/login');
      });
    });
    
    console.log(`\n${apiUrl}${endpoint} にリクエスト送信中...`);
    
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const responseData = await response.json();
    
    console.log(`\nステータスコード: ${response.status}`);
    console.log('レスポンス:');
    console.log(JSON.stringify(responseData, null, 2));
    
    if (response.ok && responseData.token) {
      console.log('\n✅ ログイン成功!');
      console.log('トークン:', responseData.token.substring(0, 20) + '...');
      
      // トークンを使用してユーザー情報を取得
      console.log('\nユーザー情報取得中...');
      const userResponse = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${responseData.token}`
        }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('ユーザー情報:');
        console.log(JSON.stringify(userData, null, 2));
      } else {
        console.log('ユーザー情報取得失敗:', userResponse.status);
      }
    } else {
      console.log('\n❌ ログイン失敗');
    }
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    rl.close();
  }
}

// 実行
testLogin();
