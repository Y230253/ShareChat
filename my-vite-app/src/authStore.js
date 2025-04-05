import { ref, computed } from 'vue';

// ユーザー状態を保持する
const user = ref(null);
const isLoggedIn = computed(() => !!user.value);

// ローカルストレージからユーザー情報を取得する初期化関数
const initAuth = () => {
  console.log('認証初期化開始');
  const storedUser = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (storedUser && token) {
    try {
      user.value = JSON.parse(storedUser);
      console.log('認証情報の復元に成功:', user.value.email || user.value.username);
    } catch (e) {
      console.error('保存されたユーザー情報の解析に失敗しました:', e);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  } else {
    console.log('保存された認証情報が見つかりません');
    if (!token && user.value) {
      // トークンがないのにユーザー情報があれば無効化
      console.warn('トークンがないためユーザー情報をクリア');
      user.value = null;
    }
  }
};

// ユーザーセット関数
const setUser = (userData) => {
  if (!userData || !userData.token) {
    console.error('無効なユーザーデータ:', userData);
    return;
  }
  
  user.value = userData;
  localStorage.setItem('user', JSON.stringify(userData));
  localStorage.setItem('token', userData.token); // トークンも別途保存
  console.log('ユーザー情報を保存しました:', userData.email || userData.username);
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
