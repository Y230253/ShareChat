import { reactive, computed, watch } from 'vue';

// リアクティブな状態オブジェクト
const state = reactive({
  isLoggedIn: false,
  user: null,
  token: null,
  error: null
});

// ストア関数
const authStore = {
  // ゲッター
  get isLoggedIn() { 
    return computed(() => state.isLoggedIn);
  },
  get user() { 
    return computed(() => state.user);
  },
  get error() {
    return computed(() => state.error);
  },
  
  // 認証初期化
  initAuth() {
    console.log('認証情報の初期化を開始...');
    const token = localStorage.getItem('token');
    
    if (token) {
      console.log('トークンが見つかりました');
      
      // ユーザーデータの復元
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          this.setUser(user);
          console.log(`ユーザーデータを復元しました: ${user.username}`);
        } catch (e) {
          console.error('ユーザーデータの復元に失敗しました', e);
          localStorage.removeItem('userData');
        }
      }
      
      state.isLoggedIn = true;
      state.token = token;
    } else {
      console.log('認証トークンが見つかりません');
      state.isLoggedIn = false;
      state.user = null;
      state.token = null;
    }
    console.log(`認証状態: ${state.isLoggedIn ? 'ログイン済み' : '未ログイン'}`);
  },
  
  // ユーザー設定
  setUser(userData) {
    state.user = userData;
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData));
    } else {
      localStorage.removeItem('userData');
    }
  },
  
  // ログイン
  login(userData, token) {
    state.isLoggedIn = true;
    state.token = token;
    this.setUser(userData);
    localStorage.setItem('token', token);
  },
  
  // ログアウト
  logout() {
    state.isLoggedIn = false;
    state.user = null;
    state.token = null;
    state.error = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
  },
  
  // エラー設定
  setError(error) {
    state.error = error;
  },
  
  // カスタムイベントリスナー用コールバック配列
  _listeners: {
    'auth-change': []
  },
  
  // イベントリスナー追加 ($subscribeの代替)
  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    
    // クリーンアップ関数を返す
    return () => {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    };
  },
  
  // イベント発火
  _emit(event, ...args) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(callback => callback(...args));
    }
  }
};

// authStoreの状態変化を監視してイベントを発火
watch(() => state.isLoggedIn, (newValue) => {
  authStore._emit('auth-change', { isLoggedIn: newValue, user: state.user });
});

export default authStore;
