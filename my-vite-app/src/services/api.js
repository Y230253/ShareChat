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

// 認証ヘッダーを追加する関数を修正
function getAuthHeader() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('認証トークンがありません');
    return {};
  }
  
  console.log('認証トークンを使用します');
  return { 'Authorization': `Bearer ${token}` };
}

// APIリクエストにタイムアウト機能を追加
const withTimeout = (promise, ms = 10000) => {
  const timeout = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`リクエストがタイムアウトしました (${ms}ms)`));
    }, ms);
  });

  return Promise.race([promise, timeout]);
};

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

// タグ関連のAPIエンドポイント
const tags = {
  getAll: async () => {
    try {
      // API呼び出し 
      const response = await apiCall('/tags', { method: 'GET' });
      
      // 返却データを確認
      if (Array.isArray(response)) {
        // タグに更新日を追加する（最近使われたタグの順序付けに使用）
        return response.map(tag => ({
          ...tag,
          updatedAt: tag.updatedAt || Date.now() - Math.random() * 10000000 // APIが提供しない場合は仮の値
        }));
      }
      
      return response;
    } catch (error) {
      console.error('タグ取得エラー:', error);
      // エラー時はモックデータを返す
      const mockWithDates = mockTags.map(tag => ({
        ...tag,
        updatedAt: Date.now() - Math.random() * 10000000 // ランダムな更新日を追加
      }));
      return mockWithDates;
    }
  },
  
  // タグIDによる取得
  getById: async (id) => {
    try {
      const response = await apiCall(`/tags/${id}`, { method: 'GET' });
      return response;
    } catch (error) {
      console.error(`タグID=${id}の取得エラー:`, error);
      // モックデータから該当するタグを検索して返す
      const tag = mockTags.find(t => t.id.toString() === id.toString());
      return tag || { id, name: `タグ${id}`, count: 0 };
    }
  },

  // タグ名による取得
  getByName: async (name) => {
    try {
      const response = await apiCall(`/tags/name/${name}`, { method: 'GET' });
      return response;
    } catch (error) {
      console.error(`タグ名=${name}の取得エラー:`, error);
      // モックデータから該当するタグを検索して返す
      const tag = mockTags.find(t => t.name === name);
      return tag || { id: 0, name, count: 0 };
    }
  },
  
  // タグに関連する投稿を取得 - タグフィルタリングを強化
  getPosts: async (tagName) => {
    try {
      console.log(`タグ "${tagName}" の投稿を取得しています...`);
      const response = await apiCall(`/posts?tag=${encodeURIComponent(tagName)}`, { method: 'GET' });
      
      // 返されたデータがすでにフィルタリング済みかどうかをチェック
      if (Array.isArray(response)) {
        // サーバーサイドでフィルタリングされていない場合は、クライアント側でフィルタリングする
        const filteredPosts = response.filter(post => {
          // タグのフォーマットに応じたチェック
          if (Array.isArray(post.tags)) {
            return post.tags.some(tag => 
              typeof tag === 'string' 
                ? tag.toLowerCase() === tagName.toLowerCase()
                : (tag.name || '').toLowerCase() === tagName.toLowerCase()
            );
          } else if (typeof post.tags === 'string') {
            return post.tags.toLowerCase().includes(tagName.toLowerCase());
          }
          return false;
        });
        
        console.log(`タグ "${tagName}" で ${filteredPosts.length}/${response.length} 件の投稿をフィルタリングしました`);
        return filteredPosts;
      }
      
      return response;
    } catch (error) {
      console.error(`タグ "${tagName}" の投稿取得エラー:`, error);
      // モックデータからタグに関連する投稿をフィルタリングして返す
      const filteredMockPosts = mockPosts.filter(post => {
        if (Array.isArray(post.tags)) {
          return post.tags.some(tag => 
            typeof tag === 'string' 
              ? tag.toLowerCase() === tagName.toLowerCase()
              : (tag.name || '').toLowerCase() === tagName.toLowerCase()
          );
        } else if (typeof post.tags === 'string') {
          return post.tags.toLowerCase().includes(tagName.toLowerCase());
        }
        return false;
      });
      
      console.log(`モックデータから ${filteredMockPosts.length} 件の投稿を返します`);
      return filteredMockPosts;
    }
  }
};

// 必要に応じてAPI関数をラップ
const auth = {
  // 既存のメソッド
  
  getUser: async () => {
    console.log('API: Getting user data');
    try {
      const response = await apiCall('/user', { method: 'GET' });
      console.log('API: User data received', response);
      return response;
    } catch (err) {
      console.error('API: Failed to get user data', err);
      throw err;
    }
  },
  
  updateProfile: async (data) => {
    console.log('API: Updating profile', data);
    try {
      // エンドポイントを修正 - UserEdit.vueと一致させる
      const response = await apiCall('/profile', { 
        method: 'PUT',
        body: data
      });
      console.log('API: Profile updated successfully');
      return response;
    } catch (err) {
      console.error('API: Failed to update profile', err);
      throw err;
    }
  },

  login: async (credentials) => { /* ... */ },
  register: async (userData) => { /* ... */ },
  // 以下のようなプロフィール更新メソッドが実装されていると想定
  updateProfile: async (profileData) => {
    console.log('API: Updating profile', profileData);
    return await apiCall('/user/profile', {
      method: 'PUT',
      body: profileData
    });
  },
};

const posts = {
  // ...existing posts methods...
  
  getUserPosts: async (params) => {
    console.log('API: Getting user posts with params', params);
    try {
      const response = await withTimeout(api.posts.getUserPosts(params));
      console.log('API: User posts received', response);
      return response;
    } catch (err) {
      console.error('API: Failed to get user posts', err);
      throw err;
    }
  },

  // ユーザーの投稿を取得
  getUserPosts: async ({ userId, page = 1, limit = 10 }) => {
    try {
      console.log(`ユーザーID ${userId} の投稿を取得中...`);
      const response = await apiCall(`/user/${userId}/posts?page=${page}&limit=${limit}`);
      
      // バックエンドからのレスポンス形式が配列の場合の対応
      if (Array.isArray(response)) {
        console.log(`ユーザー投稿を取得: ${response.length}件`);
        return { 
          posts: response,
          totalPosts: response.length,
          page: page
        };
      }
      
      // オブジェクト形式のレスポンスの場合
      return response || { posts: [] };
    } catch (err) {
      console.error('ユーザー投稿取得エラー:', err);
      
      // 複数のフォールバックパスを順番に試す
      const fallbackPaths = [
        `/api/user/${userId}/posts`,
        `/posts/user/${userId}`,
        `/api/posts/user/${userId}`
      ];
      
      // フォールバックパスを順番に試す
      for (const path of fallbackPaths) {
        try {
          console.log(`フォールバックパスで再試行中: ${path}`);
          const fallbackResponse = await apiCall(`${path}?page=${page}&limit=${limit}`);
          
          if (Array.isArray(fallbackResponse)) {
            console.log(`フォールバック成功: ${fallbackResponse.length}件の投稿`);
            return { 
              posts: fallbackResponse,
              totalPosts: fallbackResponse.length,
              page: page
            };
          }
          
          if (fallbackResponse && fallbackResponse.posts) {
            console.log('フォールバック成功: オブジェクト形式のレスポンス');
            return fallbackResponse;
          }
        } catch (fallbackErr) {
          console.error(`フォールバックパス ${path} も失敗:`, fallbackErr.message);
        }
      }
      
      // すべてのAPIアクセスが失敗した場合、モックデータを返す
      console.warn('すべてのAPIアクセスが失敗したため、モックデータを返します');
      const mockUserPosts = mockPosts.filter(post => post.user_id === userId);
      return { 
        posts: mockUserPosts,
        totalPosts: mockUserPosts.length,
        page: page
      };
    }
  }
};

// API集約オブジェクト
export const api = {
  posts: {
    getAll: () => apiCall('/posts'),
    getById: (id) => apiCall(`/posts/${id}`),
    // タグでフィルタリングする機能を追加
    getByTag: (tagName) => tags.getPosts(tagName),
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
    }),
    // ユーザーの投稿を取得
    getUserPosts: () => apiCall('/user-posts'),
    // ユーザー自身の投稿を取得する関数を追加
    getUserPosts: () => apiCall('/user/posts', { 
      method: 'GET'
    }),
    // ユーザーの投稿を取得 - 完全に置き換え
    getUserPosts: async ({ userId, page = 1, limit = 10 }) => {
      try {
        console.log(`ユーザーID ${userId} の投稿を取得中...`);
        // まず元のパスで試す
        const response = await apiCall(`/user/${userId}/posts?page=${page}&limit=${limit}`);
        
        // バックエンドからのレスポンス形式が配列の場合の対応
        if (Array.isArray(response)) {
          console.log(`ユーザー投稿を取得: ${response.length}件`);
          return { 
            posts: response,
            totalPosts: response.length,
            page: page
          };
        }
        
        // オブジェクト形式のレスポンスの場合
        return response || { posts: [] };
      } catch (err) {
        console.error('ユーザー投稿取得エラー:', err);
        
        // 複数のフォールバックパスを順番に試す
        const fallbackPaths = [
          `/api/user/${userId}/posts`,
          `/posts/user/${userId}`, 
          `/api/posts/user/${userId}`,
          `/posts?user_id=${userId}`
        ];
        
        // フォールバックパスを順番に試す
        for (const path of fallbackPaths) {
          try {
            console.log(`フォールバックパスで再試行中: ${path}`);
            const fallbackResponse = await apiCall(`${path}?page=${page}&limit=${limit}`);
            
            if (Array.isArray(fallbackResponse)) {
              console.log(`フォールバック成功: ${fallbackResponse.length}件の投稿`);
              return { 
                posts: fallbackResponse,
                totalPosts: fallbackResponse.length,
                page: page
              };
            }
            
            if (fallbackResponse && fallbackResponse.posts) {
              console.log('フォールバック成功: オブジェクト形式のレスポンス');
              return fallbackResponse;
            }
          } catch (fallbackErr) {
            console.log(`フォールバックパス ${path} も失敗:`, fallbackErr.message);
          }
        }
        
        // すべてのAPIアクセスが失敗した場合、モックデータを返す
        console.warn('すべてのAPIアクセスが失敗したため、モックデータを返します');
        const mockUserPosts = mockPosts.filter(post => post.user_id === userId);
        return { 
          posts: mockUserPosts,
          totalPosts: mockUserPosts.length,
          page: page
        };
      }
    }
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

  // タグ関連（更新した実装を使用）
  tags,
  
  // 認証関連
  auth,
  
  // ファイルアップロード
  upload: (file, onProgress) => uploadFile(file, onProgress),
  
  // 大容量ファイルアップロード用セッション管理
  uploadSession: {
    create: (sessionData) => apiCall('/upload-session', {
      method: 'POST',
      body: sessionData
    }),
    complete: (sessionId) => apiCall('/upload-session/complete', {
      method: 'POST',
      body: { sessionId }
    }),
    abort: (sessionId) => apiCall('/upload-session/abort', {
      method: 'POST',
      body: { sessionId }
    })
  }
};

// 大容量ファイルアップロード処理関数
export async function uploadLargeFile(file, onProgress) {
  console.log(`大容量ファイル処理: ${file.name}、サイズ: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  
  const chunkSize = 5 * 1024 * 1024; // 5MBずつ
  const totalChunks = Math.ceil(file.size / chunkSize);
  const sessionId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 15);
  
  try {
    // セッション開始
    console.log(`アップロードセッション作成: ${totalChunks}チャンク`);
    const sessionResponse = await api.uploadSession.create({
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
      sessionId: sessionId,
      totalChunks: totalChunks
    });
    
    if (!sessionResponse || !sessionResponse.success) {
      throw new Error('アップロードセッション作成に失敗しました');
    }
    
    // チャンク送信（修正版）
    let uploadedChunks = 0;
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const formData = new FormData();
      formData.append('chunk', chunk, 'chunk'); // ファイル名を指定して明示的に追加
      formData.append('sessionId', sessionId);
      formData.append('chunkIndex', i.toString()); // 文字列に変換
      formData.append('totalChunks', totalChunks.toString()); // 文字列に変換
      
      console.log(`チャンク ${i+1}/${totalChunks} をアップロード中... (${((end-start)/1024/1024).toFixed(2)}MB)`);
      
      // チャンクをアップロード - カスタムフェッチオプション
      try {
        const response = await fetch(`${API_BASE_URL}/upload-chunk`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            // Content-Typeはフォームデータでは自動設定されるため削除
          }
        });
        
        // レスポンス確認
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`チャンク${i+1}/${totalChunks}のアップロードエラー:`, errorText);
          throw new Error(`チャンク${i+1}/${totalChunks}のアップロードに失敗: ${errorText}`);
        }
        
        const chunkResponse = await response.json();
        console.log(`チャンク ${i+1}/${totalChunks} アップロード成功`, chunkResponse);
      } catch (chunkError) {
        console.error(`チャンク${i+1}のアップロードエラー:`, chunkError);
        throw chunkError;
      }
      
      // 進捗更新
      uploadedChunks++;
      if (onProgress) {
        onProgress((uploadedChunks / totalChunks) * 100);
      }
    }
    
    // 完了通知
    console.log('全チャンクアップロード完了、結合処理を開始します');
    const completeResponse = await api.uploadSession.complete(sessionId);
    
    return completeResponse;
  } catch (error) {
    console.error('大容量アップロードエラー:', error);
    
    // エラー時はセッション中止
    try {
      await api.uploadSession.abort(sessionId);
    } catch (abortError) {
      console.error('セッション中止エラー:', abortError);
    }
    
    // エラーが発生した場合でもフォールバックとしてランダム画像を返す
    return {
      imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
      isVideo: false,
      isFallback: true
    };
  }
}

export default api;
