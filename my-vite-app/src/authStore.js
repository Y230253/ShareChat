import { ref, readonly } from 'vue';

// 認証状態を管理するためのストア
const user = ref(null);
const isLoggedIn = ref(false);

// 初期化時にlocalStorageからユーザー情報を取得
function initAuth() {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  if (token && userData) {
    user.value = JSON.parse(userData);
    isLoggedIn.value = true;
  }
}

// ログイン時にユーザー情報をセット
function setUser(userData) {
  localStorage.setItem('user', JSON.stringify(userData));
  user.value = userData;
  isLoggedIn.value = true;
}

// ログアウト時にユーザー情報をクリア
function clearUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  user.value = null;
  isLoggedIn.value = false;
}

// エクスポート
export default {
  user: readonly(user),
  isLoggedIn: readonly(isLoggedIn),
  initAuth,
  setUser,
  clearUser
};
