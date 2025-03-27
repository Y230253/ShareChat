import { ref, readonly } from 'vue';

// 認証状態を管理するためのストア
const user = ref(null);
const isLoggedIn = ref(false);
const token = ref('');

// 初期化時にlocalStorageからユーザー情報を取得
function initAuth() {
  const storedToken = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  
  if (storedToken && userData) {
    try {
      token.value = storedToken;
      user.value = JSON.parse(userData);
      isLoggedIn.value = true;
      console.log('認証情報を復元しました:', user.value.username);
      
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
  clearUser,
  getToken
};
