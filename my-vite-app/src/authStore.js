import { ref, readonly } from 'vue';

// 認証状態を管理するためのストア
const user = ref(null);
const isLoggedIn = ref(false);
const token = ref('');

// 初期化時にlocalStorageからユーザー情報を取得
function initAuth() {
  console.log('認証情報の初期化を開始...');
  
  const storedToken = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  
  if (storedToken) {
    console.log('トークンが見つかりました');
    
    try {
      token.value = storedToken;
      
      if (userData) {
        user.value = JSON.parse(userData);
        console.log('ユーザーデータを復元しました:', user.value.username || 'unknown');
      } else {
        console.warn('トークンは存在しますが、ユーザーデータがありません');
      }
      
      isLoggedIn.value = true;
      
      // トークン検証（簡易）
      const tokenParts = storedToken.split('.');
      if (tokenParts.length !== 3) {
        console.warn('トークン形式が不正です');
        clearUser(); // 不正なトークンはクリア
        return;
      }
      
      // トークンの期限をチェック
      try {
        const payload = JSON.parse(atob(tokenParts[1]));
        const expiry = payload.exp * 1000; // JWTのexpはUNIX秒
        
        if (Date.now() >= expiry) {
          console.warn('トークンの期限が切れています');
          clearUser();
          return;
        }
      } catch (e) {
        console.error('トークン解析エラー:', e);
      }
    } catch (err) {
      console.error('認証情報の復元に失敗:', err);
      clearUser();
    }
  } else {
    console.log('認証トークンが見つかりません');
    clearUser();
  }
}

// ログイン時にユーザー情報をセット
function setUser(userData, newToken) {
  localStorage.setItem('user', JSON.stringify(userData));
  if (newToken) {
    localStorage.setItem('token', newToken);
    token.value = newToken;
  }
  user.value = userData;
  isLoggedIn.value = true;
}

// APIのレスポンス形式に対応するログインハンドラを追加
function handleLoginResponse(response) {
  if (!response) {
    console.error('ログインレスポンスが空です');
    return false;
  }
  
  // レスポンス形式を確認
  if (response.token && (response.user || response.userData)) {
    // ユーザー情報を取得
    const userData = response.user || response.userData;
    // トークンとユーザー情報を保存
    setUser(userData, response.token);
    return true;
  } else {
    console.error('不正なレスポンス形式:', response);
    return false;
  }
}

// ログアウト時にユーザー情報をクリア
function clearUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token.value = '';
  user.value = null;
  isLoggedIn.value = false;
}

// 現在のトークンを取得
function getToken() {
  return token.value || localStorage.getItem('token') || '';
}

// エクスポート
export default {
  user: readonly(user),
  isLoggedIn: readonly(isLoggedIn),
  initAuth,
  setUser,
  handleLoginResponse, // 新しいヘルパー関数をエクスポート
  clearUser,
  getToken
};
