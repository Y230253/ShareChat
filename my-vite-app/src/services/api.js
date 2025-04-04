// APIサービスの設定

// 環境に応じたベースURLを設定
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.sharechat-app.com';

// APIリクエストの共通設定
const fetchConfig = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  // credentials設定を完全に削除
};

// API呼び出し関数
export async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // 新しい設定オブジェクトを作成（元のオブジェクトを変更しない）
  const config = { 
    ...fetchConfig,
    ...options,
    headers: {
      ...fetchConfig.headers,
      ...(options.headers || {})
    }
  };
  
  // credentialsプロパティが残っていたら削除
  if ('credentials' in config) {
    delete config.credentials;
  }
  
  // 認証トークンがあれば追加
  const token = localStorage.getItem('token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  try {
    console.log(`API呼び出し: ${url}`, config);
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API呼び出しエラー: ${error.message}`);
    throw error;
  }
}

// 一般的なエンドポイント
export const api = {
  // 投稿関連
  posts: {
    getAll: () => apiCall('/posts'),
    getById: (id) => apiCall(`/posts/${id}`),
    create: (data) => apiCall('/posts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiCall(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiCall(`/posts/${id}`, { method: 'DELETE' })
  },
  
  // お気に入り関連
  favorites: {
    getAll: () => apiCall('/favorites'),
    add: (postId) => apiCall('/favorites', { method: 'POST', body: JSON.stringify({ postId }) }),
    remove: (id) => apiCall(`/favorites/${id}`, { method: 'DELETE' })
  },

  // タグ関連
  tags: {
    getAll: () => apiCall('/tags'),
    getByName: (name) => apiCall(`/tags/${name}`)
  },
  
  // 認証関連
  auth: {
    login: (credentials) => apiCall('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData) => apiCall('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    logout: () => apiCall('/auth/logout', { method: 'POST' }),
    getUser: () => apiCall('/auth/user')
  }
};

export default api;
