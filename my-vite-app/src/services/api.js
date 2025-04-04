// APIサービスの設定 - credentials属性を完全に排除

// 環境に応じたベースURLを設定
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.sharechat-app.com';

// APIリクエストの共通設定 - シンプルに
const commonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// 認証ヘッダーを追加
function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// シンプル化したAPI呼び出し関数
export async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // 新しいオブジェクトを作成（元の参照を変更しない）
  const fetchOptions = {
    method: options.method || 'GET',
    headers: {
      ...commonHeaders,
      ...getAuthHeader(),
      ...(options.headers || {})
    }
  };

  // ボディがある場合は文字列化が必要かチェック
  if (options.body) {
    if (typeof options.body === 'string') {
      fetchOptions.body = options.body;
    } else {
      fetchOptions.body = JSON.stringify(options.body);
    }
  }

  console.log(`API呼び出し: ${url}`, fetchOptions);
  
  try {
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API呼び出しエラー: ${error.message}`);
    throw error;
  }
}

// エンドポイントラッパー
export const api = {
  posts: {
    getAll: () => apiCall('/posts'),
    getById: (id) => apiCall(`/posts/${id}`),
    create: (data) => apiCall('/posts', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    update: (id, data) => apiCall(`/posts/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    delete: (id) => apiCall(`/posts/${id}`, { 
      method: 'DELETE' 
    })
  },
  
  // お気に入り関連
  favorites: {
    getAll: () => apiCall('/favorites'),
    add: (postId) => apiCall('/favorites', { 
      method: 'POST', 
      body: JSON.stringify({ postId }) 
    }),
    remove: (id) => apiCall(`/favorites/${id}`, { 
      method: 'DELETE' 
    })
  },

  // タグ関連
  tags: {
    getAll: () => apiCall('/tags'),
    getByName: (name) => apiCall(`/tags/${name}`)
  },
  
  // 認証関連
  auth: {
    login: (credentials) => apiCall('/auth/login', { 
      method: 'POST', 
      body: JSON.stringify(credentials) 
    }),
    register: (userData) => apiCall('/auth/register', { 
      method: 'POST', 
      body: JSON.stringify(userData) 
    }),
    logout: () => apiCall('/auth/logout', { 
      method: 'POST' 
    }),
    getUser: () => apiCall('/auth/user')
  }
};

export default api;
