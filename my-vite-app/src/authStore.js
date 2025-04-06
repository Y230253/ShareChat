import { ref, computed } from 'vue';

// ユーザー状態を保持する
const user = ref(null);
const isLoggedIn = computed(() => !!user.value);

// ローカルストレージからユーザー情報を取得する初期化関数
const initAuth = () => {
  console.log('Initializing auth state');
  const storedUser = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (storedUser && token) {
    try {
      user.value = JSON.parse(storedUser);
      console.log('Auth restored successfully for:', user.value.email || user.value.username);
    } catch (e) {
      console.error('保存されたユーザー情報の解析に失敗しました:', e);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  } else {
    console.log('No stored auth credentials found');
    if (user.value && !token) {
      console.warn('User info exists but no token, clearing user state');
      user.value = null;
    }
  }
};

// ユーザーセット関数
const setUser = (userData) => {
  if (!userData || !userData.token) {
    console.error('Cannot set user: Invalid user data', userData);
    return;
  }
  
  console.log('Setting user:', userData.email || userData.username);
  user.value = userData;
  localStorage.setItem('user', JSON.stringify(userData));
  localStorage.setItem('token', userData.token);
  console.log('User data saved to localStorage');
};

// ログアウト関数
const clearUser = () => {
  console.log('ユーザー情報をクリアします');
  user.value = null;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
};

// トークンが存在するか確認する関数
const hasToken = () => {
  return !!localStorage.getItem('token');
};

// トークンの有効性を簡易チェック
const isTokenValid = () => {
  const token = localStorage.getItem('token');
  // トークンがなければ無効
  if (!token) return false;
  
  try {
    // トークンが有効かJWTの形式かチェック（簡易版）
    // 実際のJWT検証はもっと複雑ですが、ここでは簡易的な実装
    const parts = token.split('.');
    return parts.length === 3;
  } catch (e) {
    console.error('トークン検証エラー:', e);
    return false;
  }
};

export default {
  user,
  isLoggedIn,
  setUser,
  clearUser,
  initAuth,
  hasToken,
  isTokenValid
};
