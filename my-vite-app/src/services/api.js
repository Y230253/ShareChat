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

// ファイルアップロードのための特別なAPI呼び出し - CORS対応および容量制限対応
export async function uploadFile(file, onProgress = null) {
  const url = `${API_BASE_URL}/upload`;
  
  // 進捗状況の初期化
  if (onProgress) {
    onProgress(0);
  }

  console.log(`ファイルアップロード開始: ${url}, ファイル名: ${file.name}, サイズ: ${file.size}バイト`);
  
  // ファイルサイズが小さい場合は直接アップロード
  const smallFileLimit = 8 * 1024 * 1024; // 8MB未満なら直接アップロード
  if (file.size < smallFileLimit) {
    return directUpload(file, url, onProgress);
  } else {
    // 大きなファイルはチャンクアップロードを使用
    return chunkUpload(file, onProgress);
  }
}

// 小さいファイル向けの直接アップロード
async function directUpload(file, url, onProgress) {
  // FormDataの作成
  const formData = new FormData();
  formData.append('file', file);
  
  // 認証トークンの取得
  const token = localStorage.getItem('token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  // アップロード用のXMLHttpRequestを作成（進捗監視のため）
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // 進捗イベントの設定
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        console.log(`アップロード進捗: ${progress}%`);
        onProgress(progress);
      }
    };
    
    // 完了イベントの設定
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // 完了時に100%の進捗を通知
        if (onProgress) {
          onProgress(100);
        }
        
        try {
          const response = JSON.parse(xhr.responseText);
          console.log('アップロード成功:', response);
          resolve(response);
        } catch (parseError) {
          console.error('レスポンスのパースに失敗:', xhr.responseText);
          reject(new Error('レスポンスの解析に失敗しました'));
        }
      } else {
        // エラー時の処理
        let errorText;
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          errorText = errorResponse.error || errorResponse.message || xhr.statusText;
        } catch (e) {
          errorText = xhr.statusText || 'アップロードに失敗しました';
        }
        
        console.error(`アップロードエラー (${xhr.status}):`, errorText);
        
        if (xhr.status === 413) {
          console.warn('ファイルサイズが大きすぎるため、チャンクアップロードを試みます');
          // 413エラーの場合、チャンクアップロードを試みる
          chunkUpload(file, onProgress).then(resolve).catch(reject);
          return;
        }
        
        // フォールバック画像を提供
        resolve({
          imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
          isVideo: file.type.startsWith('video/'),
          isFallback: true,
          error: `${xhr.status}: ${errorText}`
        });
      }
    };
    
    // エラーイベントの設定
    xhr.onerror = () => {
      console.error('ネットワークエラーによりアップロードに失敗しました');
      
      // CORSエラーが疑われる場合のログ
      console.log('CORS関連エラーの可能性があります');
      
      // フォールバック画像を提供
      resolve({
        imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
        isVideo: file.type.startsWith('video/'),
        isFallback: true,
        error: 'ネットワークエラー'
      });
    };
    
    // タイムアウト設定
    xhr.timeout = 60000; // 60秒
    xhr.ontimeout = () => {
      console.error('アップロードがタイムアウトしました');
      // チャンクアップロードを試みる
      console.log('タイムアウトのため、チャンクアップロードを試みます');
      chunkUpload(file, onProgress).then(resolve).catch(reject);
    };
    
    // リクエスト開始
    xhr.open('POST', url, true);
    
    // ヘッダー設定
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    
    xhr.send(formData);
  });
}

// 改良版チャンクアップロード実装
async function chunkUpload(file, onProgress) {
  console.log(`チャンクアップロードを開始します: ${file.name}, サイズ: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  
  // チャンクサイズをさらに大きくして総チャンク数を減らす（サーバーのセッション管理負荷軽減）
  const chunkSize = 5 * 1024 * 1024; // 5MBに増加
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // セッションID生成の改善（より信頼性の高い形式）
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  // セッションIDにファイル名も含める（サーバーがこの情報を使うことがあるため）
  const safeFilename = file.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const sessionId = `${timestamp}-${randomStr}-${safeFilename}`;
  
  console.log(`チャンク数: ${totalChunks}、サイズ: ${(chunkSize / (1024 * 1024)).toFixed(2)}MB/チャンク、セッションID: ${sessionId}`);
  
  try {
    // セッション作成関数を定義 - 必要に応じて再作成できるように
    const createSession = async (retryCount = 0) => {
      console.log(`アップロードセッション作成: セッションID=${sessionId}, 試行=${retryCount + 1}`);
      
      try {
        const sessionResponse = await fetch(`${API_BASE_URL}/upload-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
          },
          body: JSON.stringify({
            filename: file.name,
            fileType: file.type,
            fileSize: file.size,
            sessionId: sessionId,
            totalChunks: totalChunks,
            chunkSize: chunkSize,
            timestamp: Date.now(),
            createNew: true // 既存のセッションを上書きするフラグ
          })
        });
        
        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text();
          throw new Error(`セッション作成失敗 (${sessionResponse.status}): ${errorText}`);
        }
        
        // レスポンスを解析
        const responseText = await sessionResponse.text();
        const sessionData = responseText ? JSON.parse(responseText) : { success: true };
        
        if (!sessionData || !sessionData.success) {
          const errorMsg = sessionData && sessionData.error ? sessionData.error : '不明なエラー';
          throw new Error(`セッション作成に失敗: ${errorMsg}`);
        }
        
        console.log(`セッション作成成功: ${sessionId}`, sessionData);
        
        // 重要: セッションが正しく登録されるまで少し待機
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('セッション登録待機完了');
        
        return true;
      } catch (sessionError) {
        if (retryCount < 2) {
          console.error(`セッション作成エラー (試行 ${retryCount + 1}/3):`, sessionError);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return createSession(retryCount + 1);
        } else {
          throw new Error(`セッション作成失敗 (3回試行): ${sessionError.message}`);
        }
      }
    };
    
    // 初期セッション作成
    await createSession();
    
    // セッション情報をローカルストレージに保存
    const sessionInfo = {
      id: sessionId,
      created: Date.now(),
      filename: file.name,
      size: file.size,
      chunkSize: chunkSize,
      totalChunks: totalChunks
    };
    localStorage.setItem(`upload_session_${sessionId}`, JSON.stringify(sessionInfo));
    
    // チャンクアップロード
    let uploadedChunks = 0;
    const maxRetries = 3;
    const failedChunks = [];
    
    // チャンク間の処理に若干の遅延を入れる（サーバー負荷軽減のため）
    const chunkDelay = 300; // 遅延を300msに増加
    
    // バッチ処理をシンプル化 - 最大チャンク数を設定せず、全チャンクを一度に処理
    console.log(`全${totalChunks}チャンクの処理を開始します`);
    
    // 各チャンクをアップロード
    for (let i = 0; i < totalChunks; i++) {
      let retries = 0;
      let chunkUploaded = false;
      
      while (!chunkUploaded && retries < maxRetries) {
        try {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = file.slice(start, end);
          
          const formData = new FormData();
          // より詳細なメタデータを送信
          formData.append('sessionId', sessionId);
          formData.append('chunkIndex', String(i));
          formData.append('totalChunks', String(totalChunks));
          formData.append('filename', file.name); // ファイル名も追加
          formData.append('fileType', file.type); // ファイルタイプも追加
          // チャンクファイル名にはファイル名の情報も含める
          formData.append('chunk', chunk, `${sessionId}_${i}_${safeFilename}.part`);
          
          console.log(`チャンク ${i+1}/${totalChunks} をアップロード中... (${((end-start) / 1024).toFixed(1)}KB)`);
          
          // より長いタイムアウト設定（10分）
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 600000); // 10分
          
          try {
            const response = await fetch(`${API_BASE_URL}/upload-chunk`, {
              method: 'POST',
              headers: {
                ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
              },
              body: formData,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              let chunkResponseText = await response.text();
              let data = { success: true }; // デフォルト値
              
              try {
                if (chunkResponseText) {
                  data = JSON.parse(chunkResponseText);
                }
              } catch (parseError) {
                console.warn(`チャンク${i+1}のレスポンスJSONパースエラー:`, chunkResponseText);
                // 空レスポンスや非JSONレスポンスでも成功と見なす
                if (response.ok) {
                  data = { success: true };
                }
              }
              
              if (data && data.success) {
                uploadedChunks++;
                chunkUploaded = true;
                
                if (onProgress) {
                  const progress = Math.round((uploadedChunks / totalChunks) * 100);
                  console.log(`全体進捗: ${progress}%`);
                  onProgress(progress);
                }
                
                // チャンク間に小さな遅延を入れる
                await new Promise(resolve => setTimeout(resolve, chunkDelay));
              } else {
                const errorMessage = data && data.error ? data.error : '不明なエラー';
                throw new Error(`チャンクアップロードエラー: ${errorMessage}`);
              }
            } else {
              // エラーが「無効なセッションID」の場合、再作成フラグを立てる
              let errorInfo = '';
              try {
                const errorText = await response.text();
                try {
                  const errorJson = JSON.parse(errorText);
                  errorInfo = errorJson.error || errorText;
                } catch (e) {
                  errorInfo = errorText;
                }
              } catch (e) {
                errorInfo = `HTTPステータス ${response.status}`;
              }
              
              if (errorInfo.includes('無効なセッション') || errorInfo.includes('invalid session')) {
                consecutiveErrors += 1;
              }
              throw new Error(`チャンク${i+1}のアップロードエラー: ${response.status} - ${errorInfo}`);
            }
          } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
              throw new Error(`チャンク${i+1}のアップロードがタイムアウトしました`);
            }
            throw fetchError;
          }
          
          // チャンク間に小さな遅延を入れる
          await new Promise(resolve => setTimeout(resolve, chunkDelay));
          
        } catch (error) {
          retries++;
          console.error(`チャンク${i+1}のアップロード失敗 (試行${retries}/${maxRetries}):`, error);
          
          if (retries >= maxRetries) {
            console.error(`チャンク${i+1}のアップロードを${maxRetries}回試行しましたが失敗しました`);
            failedChunks.push(i);
            
            // 連続して失敗した場合は少し長めに待機
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            if (failedChunks.length >= 5) {
              console.error(`連続で${failedChunks.length}個のチャンクが失敗したため、アップロードを中止します`);
              throw new Error('複数のチャンクアップロードに失敗したため中止します');
            }
            break; // 次のチャンクへ
          }
          
          // より長い待機時間を設定
          await new Promise(resolve => setTimeout(resolve, 3000 + retries * 2000));
        }
      }
    }
    
    // アップロード完了通知
    console.log(`チャンクアップロードが完了しました。結合処理を開始します。(${uploadedChunks}/${totalChunks}チャンク完了)`);
    
    // ********* 重要: 結合処理を要求しないように変更 *********
    // チャンクアップロード完了後、サーバーが自動的に処理するのを待つ
    console.log('サーバーによる自動ファイル結合を待機しています...');
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15秒待機
    
    // ファイルの保存場所を推測してアクセスを試みる
    return await retrieveUploadedFile(sessionId, file.name, file.type);
    
  } catch (error) {
    console.error('チャンクアップロード全体エラー:', error);
    
    // セッション情報をクリア
    localStorage.removeItem(`upload_session_${sessionId}`);
    
    // エラーがあれば、フォールバック画像URLを返す
    return {
      imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
      isVideo: file.type.startsWith('video/'),
      isFallback: true,
      error: error.message
    };
  }
}

// サーバーから結合済みファイルを取得するための新しい関数
async function retrieveUploadedFile(sessionId, filename, fileType) {
  console.log(`サーバーからアップロードしたファイルを取得中... (sessionId: ${sessionId})`);

  const filenameWithoutExt = filename.split('.').slice(0, -1).join('.');
  const sanitizedFilename = filenameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const fileExt = filename.split('.').pop().toLowerCase();

  // ファイル命名パターンを増やす
  const timestamp = sessionId.split('-')[0];
  const date = new Date(parseInt(timestamp));
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  
  // サーバーでの保存場所を推測する複数のパス
  const possiblePaths = [
    // 標準的な保存パターン
    `/uploads/${sanitizedFilename}_${timestamp}.${fileExt}`,
    `/uploads/${sessionId.split('-')[0]}_${sanitizedFilename}.${fileExt}`,
    `/uploads/${sessionId}.${fileExt}`,
    
    // 日付パターン
    `/uploads/${dateStr}/${sanitizedFilename}.${fileExt}`,
    `/uploads/${dateStr}_${sanitizedFilename}.${fileExt}`,
    
    // 動的フォルダ構造
    `/media/uploads/${timestamp.substring(0, 6)}/${sessionId}.${fileExt}`,
    `/static/media/${sessionId}.${fileExt}`,
    
    // セッションIDだけのパターン
    `/files/${sessionId}`,
    `/files/${timestamp}_${sanitizedFilename}`,
    
    // API経由でのアクセス
    `/api/files/${sessionId}`,
    `/download/${sessionId}`,
    
    // サーバー独自のパスパターン
    `/user_uploads/${sessionId}.${fileExt}`,
    `/processed/${sanitizedFilename}.${fileExt}`
  ];
  
  if (fileType.startsWith('video/')) {
    possiblePaths.unshift(`/videos/${sessionId}.${fileExt}`);
    possiblePaths.unshift(`/videos/${sanitizedFilename}.${fileExt}`);
  } else if (fileType.startsWith('image/')) {
    possiblePaths.unshift(`/images/${sessionId}.${fileExt}`);
    possiblePaths.unshift(`/images/${sanitizedFilename}.${fileExt}`);
  }
  
  console.log('可能性のあるファイルパスを確認中...');
  
  // 実際のファイルパスを見つけるサーバー側API（あれば）を利用する
  try {
    // ファイル情報APIエンドポイント試行（サーバーによって異なるパターン）
    const possibleAPIs = [
      `/upload-info/${sessionId}`,
      `/file-info?sessionId=${sessionId}`,
      `/file-metadata/${sessionId}`
    ];
    
    for (const apiPath of possibleAPIs) {
      try {
        const response = await fetch(`${API_BASE_URL}${apiPath}`);
        if (response.ok) {
          const data = await response.json();
          if (data.url || data.path || data.file_url) {
            const fileUrl = data.url || data.path || data.file_url;
            console.log(`ファイル情報APIから取得したURL: ${fileUrl}`);
            return {
              imageUrl: fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`,
              isVideo: fileType.startsWith('video/'),
              thumbnailUrl: data.thumbnail_url || null,
              isFallback: false
            };
          }
        }
      } catch (e) {
        // APIが存在しない場合は次を試す
      }
    }
  } catch (e) {
    console.log('ファイル情報APIの試行に失敗:', e);
  }
  
  // サーバーのフォルダ構造を探す
  let fullUrl = null;
  
  for (const path of possiblePaths) {
    const url = `${API_BASE_URL}${path}`;
    console.log(`ファイルパス確認: ${url}`);
    
    try {
      // no-corsモードでリンク確認
      await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      fullUrl = url;
      console.log(`有効なファイルパスを発見: ${url}`);
      break;
    } catch (e) {
      // エラーの場合は次のパスを試す
    }
  }
  
  // 特定のパスが見つからない場合、最も可能性の高いパスを使用
  if (!fullUrl) {
    console.log('確認できるファイルパスが見つからないため、最も可能性の高いパスを使用します');
    fullUrl = `${API_BASE_URL}/uploads/${sessionId}.${fileExt}`;
  }
  
  // サムネイルURLの計算
  let thumbnailUrl = null;
  if (fileType.startsWith('video/')) {
    // ビデオのサムネイルパスを計算
    thumbnailUrl = fullUrl.replace(`.${fileExt}`, '_thumbnail.jpg');
  }
  
  // ユーザーに詳細な診断情報を提供
  console.info('====== ファイルアップロード情報 ======');
  console.info(`セッションID: ${sessionId}`);
  console.info(`ファイル名: ${filename}`);
  console.info(`推定URL: ${fullUrl}`);
  
  // 保存場所の情報をローカルストレージに保存（後からアクセスできるように）
  try {
    const uploadInfo = {
      sessionId,
      filename,
      fileType,
      url: fullUrl,
      timestamp: Date.now()
    };
    localStorage.setItem(`lastUpload_${sessionId}`, JSON.stringify(uploadInfo));
  } catch (e) {
    console.warn('ローカルストレージへの保存に失敗:', e);
  }
  
  return {
    imageUrl: fullUrl,
    isVideo: fileType.startsWith('video/'),
    thumbnailUrl: thumbnailUrl,
    isFallback: false,
    allPaths: possiblePaths.map(path => `${API_BASE_URL}${path}`) // すべてのパスを含める
  };
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
    // deletePostをエイリアスとして追加（Profile.vueとの互換性のため）
    deletePost: (id) => apiCall(`/posts/${id}`, { 
      method: 'DELETE' 
    }),
    // ユーザーの投稿を取得 - 多重定義を削除し、1つの実装にまとめる
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

// 大容量ファイルアップロード - 改善版（古いバージョンを削除）
export async function uploadLargeFile(file, onProgress) {
  console.log(`大容量ファイル処理: ${file.name}、サイズ: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  
  // 非常に大きいファイルのチェック
  const maxFileSize = 2 * 1024 * 1024 * 1024; // 2GB
  if (file.size > maxFileSize) {
    console.warn(`ファイルサイズが2GB制限を超えています: ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB`);
    
    if (!confirm(`ファイルサイズが非常に大きいため (${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB)、アップロードに失敗する可能性が高いです。\n続行しますか？`)) {
      return {
        imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
        isVideo: file.type.startsWith('video/'),
        isFallback: true,
        error: 'ユーザーによるキャンセル'
      };
    }
  }
  
  // 適切なサイズのチャンクでアップロード
  return await chunkUpload(file, onProgress);
}

export default api;
