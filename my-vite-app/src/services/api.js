// APIサービスの設定 - モックデータフォールバック追加

// 環境に応じたベースURLを設定
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.sharechat-app.com';

// モックデータのインポート
import { mockPosts, mockTags } from './mock-data.js';

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
  // URLの正規化（localhostへの参照を避ける）
  const url = `${API_BASE_URL}${endpoint}`;
  
  // デバッグ情報
  console.log(`API呼び出し: ${url}`, {
    method: options.method || 'GET',
    hasAuth: !!localStorage.getItem('token'),
    hasBody: !!options.body
  });
  
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
      
      // 特定のエンドポイントで404エラーの場合、モックデータを返す
      if (response.status === 404) {
        if (endpoint === '/tags') {
          console.warn('タグAPIが見つからないため、モックデータを使用します');
          return mockTags;
        } else if (endpoint === '/posts' || endpoint.startsWith('/posts/')) {
          console.warn('投稿APIが見つからないため、モックデータを使用します');
          // IDが指定されていれば、特定の投稿を返す
          if (endpoint.startsWith('/posts/') && endpoint !== '/posts/') {
            const id = parseInt(endpoint.split('/').pop());
            const post = mockPosts.find(p => p.id === id);
            if (post) return post;
          }
          return mockPosts;
        }
        
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
    
    // ネットワークエラーやその他のエラーの場合にもモックデータを返す
    if ((endpoint === '/tags' || endpoint.startsWith('/tags/')) && options.method === 'GET') {
      console.warn('タグAPI呼び出しに失敗したため、モックデータを使用します');
      return mockTags;
    } else if ((endpoint === '/posts' || endpoint.startsWith('/posts/')) && options.method === 'GET') {
      console.warn('投稿API呼び出しに失敗したため、モックデータを使用します');
      return mockPosts;
    }
    
    throw error;
  }
}

// ファイルアップロードのための特別なAPI呼び出し - 修正
export async function uploadFile(file, onProgress = null) {
  const url = `${API_BASE_URL}/upload`;

  // FormDataの作成
  const formData = new FormData();
  formData.append('file', file);
  
  console.log(`ファイルアップロード開始: ${url}, ファイル名: ${file.name}, サイズ: ${file.size}バイト`);
  
  try {
    // 統一バケットレベルアクセス対応のためのヘッダー
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: headers
    });
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData.error || errorData.message || '';
      } catch {
        try {
          errorText = await response.text();
        } catch (textError) {
          errorText = '応答の読み取りに失敗';
        }
      }
      
      console.error(`アップロードエラー (${response.status}):`, errorText);
      
      // エラー種別で処理を分ける
      if (errorText.includes('uniform bucket-level access') || 
          errorText.includes('permission denied') ||
          response.status === 403 || 
          response.status === 500) {
        console.warn('サーバーエラーのため、フォールバック画像URLを使用します');
        // ランダム画像URLを生成
        return {
          imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
          isVideo: false,
          isFallback: true
        };
      }
      
      throw new Error(`アップロード失敗: ${errorText || response.statusText}`);
    }
    
    const data = await response.json();
    
    // フォールバック画像かどうかをチェック
    if (data.isFallback) {
      console.warn('サーバーからフォールバック画像が返されました');
    } else {
      console.log('アップロード成功:', data.imageUrl);
    }
    
    return data;
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    // エラー時のフォールバック
    return {
      imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
      isVideo: false,
      isFallback: true
    };
  }
}

// エンドポイントラッパー
export const api = {
  posts: {
    getAll: () => apiCall('/posts'),
    getById: (id) => apiCall(`/posts/${id}`),
    create: (data) => apiCall('/posts', { 
      method: 'POST', 
      body: data 
    }),
    update: (id, data) => apiCall(`/posts/${id}`, { 
      method: 'PUT', 
      body: data 
    }),
    delete: (id) => apiCall(`/posts/${id}`, { 
      method: 'DELETE' 
    })
  },
  
  // いいね関連
  likes: {
    check: (postId) => apiCall(`/check-like/${postId}`),
    add: (postId) => apiCall('/likes', { 
      method: 'POST', 
      body: { post_id: postId } 
    }),
    remove: (postId) => apiCall('/likes', { 
      method: 'DELETE', 
      body: { post_id: postId } 
    })
  },
  
  // ブックマーク関連
  bookmarks: {
    check: (postId) => apiCall(`/check-bookmark/${postId}`),
    add: (postId) => apiCall('/bookmarks', { 
      method: 'POST', 
      body: { post_id: postId } 
    }),
    remove: (postId) => apiCall('/bookmarks', { 
      method: 'DELETE', 
      body: { post_id: postId } 
    }),
    // ブックマークした投稿を取得するエンドポイントを追加
    getPosts: () => apiCall('/bookmarked-posts')
  },

  // お気に入り関連
  favorites: {
    getAll: () => apiCall('/favorites'),
    add: (postId) => apiCall('/favorites', { 
      method: 'POST', 
      body: { postId } 
    }),
    remove: (id) => apiCall(`/favorites/${id}`, { 
      method: 'DELETE' 
    })
  },

  // タグ関連
  tags: {
    getAll: () => apiCall('/tags'),
    getByName: (name) => apiCall(`/tags/${name}`),
    // タグでフィルタリングされた投稿を取得するメソッドを追加
    getPostsByTag: (tagName) => apiCall(`/posts-by-tag/${encodeURIComponent(tagName)}`)
  },
  
  // 認証関連
  auth: {
    login: (credentials) => apiCall('/auth/login', { 
      method: 'POST', 
      body: credentials
    }),
    register: (userData) => apiCall('/auth/register', { 
      method: 'POST', 
      body: userData
    }),
    logout: () => apiCall('/auth/logout', { 
      method: 'POST' 
    }),
    getUser: () => apiCall('/auth/me')
  },
  
  // ファイルアップロード
  upload: (file, onProgress) => uploadFile(file, onProgress)
};

export default api;
