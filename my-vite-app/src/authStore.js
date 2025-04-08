import { ref } from 'vue';
import { api } from './services/api.js'; 

// 認証状態の管理
const isLoggedIn = ref(!!localStorage.getItem('token'));
const user = ref(null);
const tokenExpiredNotified = ref(false); // トークン期限切れ通知フラグ

// トークン期限切れイベントを監視
window.addEventListener('auth:token_expired', () => {
  console.log('トークン期限切れイベント受信');
  isLoggedIn.value = false;
  user.value = null;
  
  // 重複通知を防止
  if (!tokenExpiredNotified.value) {
    tokenExpiredNotified.value = true;
    setTimeout(() => {
      tokenExpiredNotified.value = false;
    }, 5000);
  }
});

// ユーザー情報をロードする関数
async function loadUser() {
  try {
    if (localStorage.getItem('token')) {
      // デバッグ情報を追加
      console.log('トークンを使用してユーザー情報をロード中...');
      const userData = await api.auth.getUser();
      user.value = userData;
      console.log('ユーザー情報のロードに成功:', user.value);
      return userData;
    }
  } catch (error) {
    console.error('ユーザー情報のロードに失敗:', error);
    
    // トークンエラーの場合はクリア
    if (error.message && error.message.includes('トークン')) {
      logout();
    }
    
    return null;
  }
}

// ログイン関数
async function login(userData) {
  isLoggedIn.value = true;
  user.value = userData;
}

// 認証初期化関数（クライアント側でこの関数を期待している）
async function initAuth(loginData) {
  console.log('認証初期化中:', loginData);
  
  if (loginData && loginData.token) {
    localStorage.setItem('token', loginData.token);
    isLoggedIn.value = true;
    
    if (loginData.user) {
      user.value = loginData.user;
      console.log('認証初期化成功:', user.value);
    } else {
      // ユーザー情報がレスポンスに含まれていない場合は取得
      await loadUser();
    }
    
    return true;
  } else {
    console.error('認証初期化失敗: トークンがありません');
    return false;
  }
}

// ログアウト関数
function logout() {
  localStorage.removeItem('token');
  isLoggedIn.value = false;
  user.value = null;
}

// アプリケーション起動時に認証状態をチェック
const checkAuthOnStartup = async () => {
  console.log('アプリケーション起動時の認証チェック');
  const token = localStorage.getItem('token');
  
  if (token) {
    try {
      await loadUser();
    } catch (err) {
      console.warn('起動時の認証確認に失敗:', err);
    }
  }
};

// 初回読み込み時に自動実行
checkAuthOnStartup();

export default {
  isLoggedIn,
  user,
  login,
  logout,
  loadUser,
  initAuth // 新しく追加した初期化メソッド
};
