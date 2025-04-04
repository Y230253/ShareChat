// APIサービスの設定 - デバッグ機能強化

// 環境に応じたベースURLを設定
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.sharechat-app.com';

// APIリクエストの共通設定
const commonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// 認証ヘッダーを追加
function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// API呼び出し関数
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

  // ボディ処理の改善
  if (options.body) {
    if (typeof options.body === 'string') {
      fetchOptions.body = options.body;
    } else {
      fetchOptions.body = JSON.stringify(options.body);
    }
  }

  // デバッグ情報
  console.log(`API呼び出し: ${url}`, {...fetchOptions, body: options.body ? '(データあり)' : undefined});
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // ステータスコード表示の追加
    console.log(`API応答: ${url} - ステータス: ${response.status}`);
    
    if (!response.ok) {
      // エラーレスポンスのデバッグ
      let errorDetails;
      let errorText = '';
      
      try {
        errorDetails = await response.json();
        errorText = errorDetails.error || errorDetails.message || '';
      } catch (e) {
        try {
          errorText = await response.text();
        } catch (textError) {
          errorText = '応答の読み取りに失敗';
        }
      }
      
      console.error(`API エラー (${response.status}):`, errorText || response.statusText);
      
      // 404の場合は特定のエラーメッセージ
      if (response.status === 404) {
        throw new Error(`API エンドポイントが見つかりません: ${endpoint}`);
      }
      
      throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
    }
    
    const data = await response.json();
    
    // 短いデバッグ出力
    console.log(`API成功: ${url} - データ:`, 
      typeof data === 'object' ? `(${Array.isArray(data) ? data.length + 'アイテム' : 'オブジェクト'})` : data);
    
    return data;
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
      body: credentials  // 自動的にJSONに変換
    }),
    register: (userData) => apiCall('/auth/register', { 
      method: 'POST', 
      body: userData  // 自動的にJSONに変換
    }),
    logout: () => apiCall('/auth/logout', { 
      method: 'POST' 
    }),
    getUser: () => apiCall('/auth/user')
  }
};

export default api;
