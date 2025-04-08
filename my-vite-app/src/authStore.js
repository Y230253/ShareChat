import { ref, computed } from 'vue';
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

// ログアウト関数
function logout() {
  localStorage.removeItem('token');
  isLoggedIn.value = false;
  user.value = null;
  
  // ログアウト時にリダイレクトするのは任意
  // window.location.href = '/login';
}

// 認証状態のチェック - 初回読み込み時に自動実行
loadUser();

export default {
  isLoggedIn,
  user,
  login,
  logout,
  loadUser
};
