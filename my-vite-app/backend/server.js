import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';   // fs/promisesをインポート
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Storage } from '@google-cloud/storage';
import stream from 'stream';
// fsの通常モジュールも追加 (existsSyncなどのために必要)
import * as fsSync from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Google Cloud Storage 設定
let storage;
try {
  storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: path.join(__dirname, 'gcp-key.json')
  });
  console.log('Google Cloud Storage初期化成功');
} catch (error) {
  console.error('Google Cloud Storageの初期化エラー:', error);
  // エラーが発生してもサーバー起動を続行
}

const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'sharechat-media-bucket';
let bucket;
try {
  bucket = storage.bucket(bucketName);
  console.log(`バケット ${bucketName} にアクセス準備完了`);
} catch (error) {
  console.error(`バケット ${bucketName} へのアクセスエラー:`, error);
}

const app = express();

// CORSの設定を緩和（すべてのオリジンを許可）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false // credentialsを使用しない
}));

// 環境変数の表示（デバッグ用）
console.log('環境変数:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log('GOOGLE_CLOUD_STORAGE_BUCKET:', process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '設定済み' : '未設定');

// Cloud Storage内のJSONファイルパス設定
const dataFilePath = 'data/PhotoData.json';
const userDataFilePath = 'data/UserData.json';

// JWT秘密鍵の環境変数から取得
const JWT_SECRET = process.env.JWT_SECRET || 'sharechat_app_secret_key_1234567890';

app.use(express.json());

// 静的ファイルを提供する設定
app.use(express.static(path.join(__dirname, '../dist')));

// ファイル読み書き用ヘルパー関数 - Cloud Storage対応
async function readGCSFile(filePath) {
  try {
    console.log(`GCSファイル読み込み開始: ${filePath}`);
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    
    if (!exists) {
      console.log(`File ${filePath} does not exist, returning default data`);
      if (filePath === userDataFilePath) {
        return { users: [] };
      } else {
        return { users: [], posts: [], likes: [], bookmarks: [], comments: [], tags: [] };
      }
    }
    
    console.log(`ファイル ${filePath} が存在します、ダウンロード中...`);
    const [content] = await file.download();
    const contentStr = content.toString();
    console.log(`ファイル内容長: ${contentStr.length}文字`);
    
    try {
      const parsedData = JSON.parse(contentStr);
      console.log(`データパース成功: ${filePath}`);
      
      // ユーザーデータの場合、追加情報を表示
      if (filePath === userDataFilePath && parsedData.users) {
        console.log(`ユーザー数: ${parsedData.users.length}`);
        if (parsedData.users.length > 0) {
          console.log(`最初のユーザー: ID=${parsedData.users[0].id}, 名前=${parsedData.users[0].username}`);
        }
      }
      
      return parsedData;
    } catch (parseError) {
      console.error(`JSONのパースエラー: ${filePath}`, parseError);
      console.log(`内容の冒頭: ${contentStr.substring(0, 100)}...`);
      throw parseError;
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    // エラー時にもデフォルト値を返す（耐障害性向上）
    if (filePath === userDataFilePath) {
      return { users: [] };
    } else {
      return { users: [], posts: [], likes: [], bookmarks: [], comments: [], tags: [] };
    }
  }
}

async function writeGCSFile(filePath, data) {
  try {
    const file = bucket.file(filePath);
    const jsonContent = JSON.stringify(data, null, 2);
    
    await file.save(jsonContent, {
      contentType: 'application/json',
      metadata: { cacheControl: 'no-cache' }
    });
    
    console.log(`Successfully wrote to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error writing to file ${filePath}:`, error);
    throw error;
  }
}

// データアクセス関数の更新
async function readData() {
  return readGCSFile(dataFilePath);
}

async function writeData(data) {
  return writeGCSFile(dataFilePath, data);
}

async function readUserData() {
  return readGCSFile(userDataFilePath);
}

async function writeUserData(data) {
  return writeGCSFile(userDataFilePath, data);
}

// Cloud Storageへのファイルアップロード設定
const multerStorage = multer.memoryStorage();
const upload = multer({
  storage: multerStorage,
  fileFilter: (req, file, cb) => {
    // 許可するMIMEタイプ
    const allowedMimeTypes = [
      // 画像
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
      // 動画
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('サポートしていないファイル形式です。画像または動画ファイルをアップロードしてください。'), false);
    }
  }
});

// 画像・動画アップロードAPI - Cloud Storage対応
app.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, async function(err) {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({ error: err.message || 'アップロードに失敗しました' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }
    
    try {
      // ファイル名の作成
      const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
      const filePath = `uploads/${fileName}`;
      const fileBuffer = req.file.buffer;
      
      console.log(`ファイルアップロード試行: ${filePath}, サイズ: ${fileBuffer.length}バイト`);
      
      // Cloud Storageアップロードの代わりにサーバーで処理
      try {
        // Cloud Storageにアップロード - バケットレベルアクセスを考慮
        const file = bucket.file(filePath);
        
        // アップロードストリーム設定
        const passthroughStream = new stream.PassThrough();
        passthroughStream.write(fileBuffer);
        passthroughStream.end();
        
        await new Promise((resolve, reject) => {
          passthroughStream.pipe(file.createWriteStream({
            metadata: {
              contentType: req.file.mimetype,
            },
            resumable: false, // 小さいファイル用に最適化
          }))
          .on('finish', resolve)
          .on('error', reject);
        });
        
        // 公開設定（統一バケットレベルアクセスを考慮）
        try {
          await file.makePublic();
        } catch (publicError) {
          console.warn('ファイル公開設定スキップ:', publicError.message);
          // エラーは無視して続行
        }
        
        // 公開URL生成
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
        
        // ファイルタイプ（画像または動画）を判別
        const isVideo = req.file.mimetype.startsWith('video/');
        
        console.log(`アップロード成功: ${publicUrl}, タイプ: ${isVideo ? '動画' : '画像'}`);
        
        res.json({ 
          imageUrl: publicUrl,
          isVideo: isVideo
        });
      } catch (storageError) {
        console.error('Cloud Storageエラー:', storageError);
        
        // フォールバック: 一時的なランダム画像URLを使用
        res.json({
          imageUrl: `https://picsum.photos/seed/${Date.now()}/800/600`,
          isVideo: false,
          isFallback: true
        });
      }
    } catch (error) {
      console.error('ファイルアップロードエラー:', error);
      res.status(500).json({ error: 'ファイルのアップロードに失敗しました: ' + error.message });
    }
  });
});

// 認証ミドルウェア
function authenticateToken(req, res, next) {
  console.log('認証ミドルウェア実行:', req.path)
  const authHeader = req.headers.authorization
  
  if (!authHeader) {
    console.log('Authorization ヘッダーがありません')
    return res.status(401).json({ error: 'トークンがありません' })
  }
  
  console.log('Authorization ヘッダー:', authHeader.substring(0, 15) + '...')
  
  const token = authHeader.split(' ')[1]
  if (!token) {
    console.log('Bearerトークンが見つかりません')
    return res.status(401).json({ error: 'トークン形式が不正です' })
  }
  
  console.log('トークン検証開始:', token.substring(0, 10) + '...')
  console.log('使用する秘密鍵:', JWT_SECRET ? JWT_SECRET.substring(0, 3) + '...' : '未設定')
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('トークン検証エラー:', err.message)
      return res.status(403).json({ error: '無効なトークン: ' + err.message })
    }
    
    console.log('トークン検証成功:', user.id)
    req.user = user
    next()
  })
}

// 認証関連のロジック - 共通関数として抽出
async function handleLogin(req, res) {
  try {
    console.log('ログイン処理開始...');
    const { email, password } = req.body;
    console.log(`リクエスト内容: email=${email}, password=${password ? '******' : 'なし'}`);
    
    if (!email || !password) {
      console.log('必須フィールドが不足しています');
      return res.status(400).json({ error: 'メールアドレスとパスワードが必要です' });
    }

    console.log(`ログイン試行: ${email}`);
    const userData = await readUserData();
    console.log(`ユーザーデータ取得完了: ${userData.users?.length || 0}件のユーザー`);
    
    const user = userData.users.find(u => u.email === email);

    if (!user) {
      console.log(`ユーザーが見つかりません: ${email}`);
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    console.log(`ユーザー認証: ID=${user.id}, Email=${user.email}, HashedPassword: ${user.password ? '***存在します***' : '存在しません'}`);

    // bcrypt.compareを使用してプレーンテキストのパスワードとハッシュ化されたパスワードを比較
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`パスワード検証結果: ${isPasswordValid ? '一致' : '不一致'}`);
    
    if (!isPasswordValid) {
      console.log(`パスワードが一致しません: ${email}`);
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // JWTトークンの生成
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // ユーザー情報からパスワードを除外
    const { password: _, ...userWithoutPassword } = user;

    console.log(`ログイン成功: ${email}, ユーザーID: ${user.id}`);
    
    // フロントエンドが期待するレスポンス形式に合わせる
    // 注意: トークンをトップレベルで提供し、ユーザー情報を含める
    res.json({
      success: true,
      token: token,
      user: userWithoutPassword,
      message: 'ログイン成功'
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました: ' + error.message });
  }
}

async function handleRegister(req, res) {
  console.log('登録処理開始:', req.body);
  
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: '全てのフィールドが必要です' });
    }

    const userData = await readUserData();

    // 同じメールアドレスがないか重複チェック
    if (userData.users.some(user => user.email === email)) {
      return res.status(400).json({ error: '既に登録されています' });
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // アイコン画像のURL処理
    let iconUrl = null;
    if (req.file) {
      try {
        // Cloud Storageにアップロード
        const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
        const filePath = `uploads/${fileName}`;
        const file = bucket.file(filePath);
        
        const passthroughStream = new stream.PassThrough();
        passthroughStream.write(req.file.buffer);
        passthroughStream.end();
        
        await new Promise((resolve, reject) => {
          passthroughStream.pipe(file.createWriteStream({
            metadata: {
              contentType: req.file.mimetype,
            },
            public: true,
          }))
          .on('finish', resolve)
          .on('error', reject);
        });
        
        iconUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
      } catch (uploadError) {
        console.error('アイコンアップロードエラー:', uploadError);
        // アイコンアップロードに失敗しても処理は続行
      }
    }
    
    const newUser = {
      id: userData.users.length ? userData.users[userData.users[userData.users.length - 1].id + 1 ]: 1,
      username,
      email,
      password: hashedPassword,
      icon_url: iconUrl
    };
    userData.users.push(newUser);
    await writeUserData(userData);
    console.log(`ユーザー登録成功: ${email}, ID: ${newUser.id}`);
    return res.status(201).json({ message: '登録成功' });
  } catch (error) {
    console.error('登録エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました: ' + error.message });
  }
}

// 既存のログインエンドポイント
app.post('/login', handleLogin);

// 追加: /auth/login エンドポイント (フロントエンドとの互換性のため)
app.post('/auth/login', (req, res) => {
  console.log('認証ルート /auth/login が呼び出されました');
  handleLogin(req, res);
});

// 🔹 ユーザー登録 API - リファクタリング
app.post('/register', upload.single('icon'), (req, res) => {
  handleRegister(req, res);
});

// 追加: /auth/register エンドポイント (フロントエンドとの互換性のため)
app.post('/auth/register', upload.single('icon'), (req, res) => {
  console.log('認証ルート /auth/register が呼び出されました');
  handleRegister(req, res);
});

// 追加: /auth/me エンドポイント (ユーザー情報取得)
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`ユーザー情報取得: ID=${userId}`);
    
    const userData = await readUserData();
    const user = userData.users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    // パスワードを除外したユーザー情報を返す
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
);
// 🔹 ユーザー登録 API - エラーハンドリング強化
app.post('/register', upload.single('icon'), async (req, res) => {
  console.log('登録処理開始:', req.body);
  
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: '全てのフィールドが必要です' });
    }

    const userData = await readUserData();

    // 同じメールアドレスがないか重複チェック
    if (userData.users.some(user => user.email === email)) {
      return res.status(400).json({ error: '既に登録されています' });
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // アイコン画像のURL処理
    let iconUrl = null;
    if (req.file) {
      try {
        // Cloud Storageにアップロード
        const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
        const filePath = `uploads/${fileName}`;
        const file = bucket.file(filePath);
        
        const passthroughStream = new stream.PassThrough();
        passthroughStream.write(req.file.buffer);
        passthroughStream.end();
        
        await new Promise((resolve, reject) => {
          passthroughStream.pipe(file.createWriteStream({
            metadata: {
              contentType: req.file.mimetype,
            },
            public: true,
          }))
          .on('finish', resolve)
          .on('error', reject);
        });
        
        iconUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
      } catch (uploadError) {
        console.error('アイコンアップロードエラー:', uploadError);
        // アイコンアップロードに失敗しても処理は続行
      }
    }
    
    const newUser = {
      id: userData.users.length ? userData.users[userData.users[userData.users.length - 1].id + 1 ]: 1,
      username,
      email,
      password: hashedPassword,
      icon_url: iconUrl
    };
    userData.users.push(newUser);
    await writeUserData(userData);
    return res.status(201).json({ message: '登録成功' });
  } catch (error) {
    console.error('登録エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました: ' + error.message });
  }
});

// 投稿 API（JSON版） - Cloud Storage対応
app.post('/posts', authenticateToken, async (req, res) => {
  console.log('投稿処理開始:', req.user.id);
  
  const { image_url, message, isVideo, tags } = req.body;
  console.log('投稿内容:', { 
    image_url: image_url ? image_url.substring(0, 20) + '...' : '未設定', 
    message: message ? message.substring(0, 20) + '...' : '未設定',
    isVideo: isVideo || false,
    tags: tags || []
  });
  
  try {
    const data = await readData();
    const userData = await readUserData();
    
    // ユーザー情報を取得
    const user = userData.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    const user_id = req.user.id;
    const id = data.posts.length > 0 ? data.posts[data.posts.length - 1].id + 1 : 1;
    
    // Cloud StorageのURLをそのまま使用
    const relativeImageUrl = image_url;
    
    // 投稿データにユーザー名とアイコン、メディアタイプを追加
    const newPost = { 
      id, 
      user_id, 
      username: user.username, 
      user_icon: user.icon_url || null, 
      image_url: relativeImageUrl, 
      message,
      isVideo: isVideo || false, 
      created_at: new Date().toISOString(), 
      likeCount: 0,
      bookmarkCount: 0,
      tags: tags || [] // タグ情報を保存
    };
    
    data.posts.push(newPost);

    // 新しいタグがあれば追加
    if (tags && tags.length) {
      // tags配列が無ければ初期化
      if (!Array.isArray(data.tags)) {
        data.tags = [];
      }

      // 存在しないタグを追加
      tags.forEach(tagName => {
        const normalizedTag = tagName.toLowerCase().trim();
        if (normalizedTag && !data.tags.some(t => t.name.toLowerCase() === normalizedTag)) {
          const tagId = data.tags.length > 0 ? Math.max(...data.tags.map(t => t.id)) + 1 : 1;
          data.tags.push({
            id: tagId,
            name: tagName.trim(),
            count: 1
          });
        } else if (normalizedTag) {
          // 既存のタグのカウントを増やす
          const existingTag = data.tags.find(t => t.name.toLowerCase() === normalizedTag);
          if (existingTag) {
            existingTag.count = (existingTag.count || 0) + 1;
          }
        }
      });
    }
    
    await writeData(data);
    res.json(newPost);
  } catch (err) {
    console.error("投稿処理エラー:", err);
    res.status(500).json({ error: '投稿エラー: ' + err.message });
  }
});

// ルートエンドポイント - ヘルスチェック用
app.get('/', (req, res) => {
  res.json({ 
    message: "ShareChat API Server is running",
    version: "1.0",
    timestamp: new Date().toISOString()
  });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: "ShareChat API Health Check OK",
    env: {
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
      BUCKET: process.env.GOOGLE_CLOUD_STORAGE_BUCKET
    }
  });
});

// ユーザー一覧取得API
app.get('/api/users', async (req, res) => {
  try {
    const userData = await readUserData();
    // パスワードなどの機密情報を除いて返す
    const safeUserData = userData.users.map(user => ({
      id: user.id,
      username: user.username,
      icon_url: user.icon_url
    }));
    res.json(safeUserData);
  } catch (err) {
    console.error('ユーザー情報取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 投稿一覧取得API - 両方のエンドポイントで対応
app.get('/api/photos', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.posts);
  } catch (err) {
    console.error('投稿一覧取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 追加: フロントエンドと一致させるためのパス
app.get('/posts', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.posts);
  } catch (err) {
    console.error('投稿一覧取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// タグ関連のエンドポイント - 既存のがあれば置き換え
app.get('/tags', async (req, res) => {
  try {
    const data = await readData();
    
    // tags配列が初期化されていなければ初期化
    if (!Array.isArray(data.tags)) {
      data.tags = [];
    }
    
    // タグが見つからない場合はデフォルトタグを生成
    if (data.tags.length === 0) {
      const defaultTags = [
        { id: 1, name: '風景', count: 10 },
        { id: 2, name: '料理', count: 8 },
        { id: 3, name: '旅行', count: 7 },
        { id: 4, name: '動物', count: 6 },
        { id: 5, name: 'スポーツ', count: 5 },
        { id: 6, name: 'テクノロジー', count: 4 },
        { id: 7, name: 'アート', count: 3 },
        { id: 8, name: '音楽', count: 2 }
      ];
      
      // デフォルトタグを追加
      data.tags = defaultTags;
      await writeData(data);
    }
    
    res.json(data.tags);
  } catch (err) {
    console.error('タグ取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 特定のタグに関連する投稿を取得
app.get('/tags/:name', async (req, res) => {
  try {
    const tagName = req.params.name.toLowerCase();
    const data = await readData();
    
    // 指定されたタグを含む投稿をフィルタリング
    const filteredPosts = data.posts.filter(post => 
      Array.isArray(post.tags) && 
      post.tags.some(tag => tag.toLowerCase() === tagName)
    );
    
    res.json(filteredPosts);
  } catch (err) {
    console.error('タグ別投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// データ確認エンドポイント (開発/デバッグ用)
app.get('/api/debug/users', async (req, res) => {
  try {
    const userData = await readGCSFile(userDataFilePath);
    // 機密情報を除外
    const safeUserData = {
      count: userData.users?.length || 0,
      users: (userData.users || []).map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        icon_url: user.icon_url,
        has_password: !!user.password
      }))
    };
    res.json(safeUserData);
  } catch (err) {
    res.status(500).json({ error: 'ユーザーデータ取得エラー: ' + err.message });
  }
});

// テスト用エンドポイント - ハッシュ化されたパスワードを生成
app.get('/api/debug/generate-password/:password', async (req, res) => {
  try {
    const password = req.params.password;
    const hashedPassword = await bcrypt.hash(password, 10);
    res.json({
      original: password,
      hashed: hashedPassword
    });
  } catch (err) {
    res.status(500).json({ error: 'パスワードハッシュ生成エラー: ' + err.message });
  }
});

// テスト用エンドポイント - フロントエンドのログイン状態確認用
app.get('/api/debug/auth-test', authenticateToken, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user,
    message: '認証済みユーザーです'
  });
});

// テスト用エンドポイント - フロントエンド開発用のモックトークン生成
app.get('/api/debug/mock-token/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '有効なユーザーIDを指定してください' });
    }
    
    const userData = await readUserData();
    const user = userData.users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: `ID ${userId} のユーザーが見つかりません` });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // パスワードを除外したユーザー情報を返す
    const { password, ...userInfo } = user;
    
    res.json({
      token,
      user: userInfo
    });
  } catch (error) {
    res.status(500).json({ error: 'トークン生成エラー: ' + error.message });
  }
});

// いいね状態チェックAPIの追加
app.get('/check-like/:postId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = parseInt(req.params.postId);
    
    console.log(`いいねチェック: user_id=${userId}, post_id=${postId}`);
    
    const data = await readData();
    
    // いいね配列がなければ初期化
    if (!Array.isArray(data.likes)) {
      data.likes = [];
    }
    
    // ユーザーがこの投稿にいいねしているかチェック
    const hasLiked = data.likes.some(like => 
      like.user_id === userId && like.post_id === postId
    );
    
    res.json({ liked: hasLiked });
  } catch (err) {
    console.error('いいねチェックエラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// いいね追加API
app.post('/likes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { post_id } = req.body;
    
    if (!post_id) {
      return res.status(400).json({ error: '投稿IDが必要です' });
    }
    
    const data = await readData();
    
    // 配列初期化
    if (!Array.isArray(data.likes)) {
      data.likes = [];
    }
    
    // 既にいいねがあるか確認
    const existingLike = data.likes.find(like => 
      like.user_id === userId && like.post_id === post_id
    );
    
    if (existingLike) {
      return res.status(400).json({ error: '既にいいねしています' });
    }
    
    // 新しいいいねを追加
    const newLike = {
      id: data.likes.length > 0 ? Math.max(...data.likes.map(l => l.id)) + 1 : 1,
      user_id: userId,
      post_id: post_id,
      created_at: new Date().toISOString()
    };
    
    data.likes.push(newLike);
    
    // 投稿のいいね数を更新
    const post = data.posts.find(p => p.id === post_id);
    if (post) {
      post.likeCount = (post.likeCount || 0) + 1;
    }
    
    await writeData(data);
    
    res.status(201).json(newLike);
  } catch (err) {
    console.error('いいね追加エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// いいね削除API
app.delete('/likes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { post_id } = req.body;
    
    if (!post_id) {
      return res.status(400).json({ error: '投稿IDが必要です' });
    }
    
    const data = await readData();
    
    // いいね配列の初期化チェック
    if (!Array.isArray(data.likes)) {
      return res.status(404).json({ error: 'いいねが見つかりません' });
    }
    
    // いいねのインデックスを検索
    const likeIndex = data.likes.findIndex(like => 
      like.user_id === userId && like.post_id === post_id
    );
    
    if (likeIndex === -1) {
      return res.status(404).json({ error: 'いいねが見つかりません' });
    }
    
    // いいねを削除
    data.likes.splice(likeIndex, 1);
    
    // 投稿のいいね数を更新
    const post = data.posts.find(p => p.id === post_id);
    if (post && post.likeCount > 0) {
      post.likeCount--;
    }
    
    await writeData(data);
    
    res.json({ message: 'いいねを削除しました' });
  } catch (err) {
    console.error('いいね削除エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// コメント関連API
// コメント一覧取得
app.get('/comments/:postId', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const data = await readData();
    
    // コメント配列の初期化チェック
    if (!Array.isArray(data.comments)) {
      data.comments = [];
    }
    
    // 指定された投稿IDのコメントをフィルタリング
    const filteredComments = data.comments.filter(comment => comment.post_id === postId);
    
    // ユーザーデータを追加
    const userData = await readUserData();
    const commentsWithUserData = filteredComments.map(comment => {
      const user = userData.users.find(u => u.id === comment.user_id);
      return {
        ...comment,
        username: user ? user.username : `ユーザー ${comment.user_id}`,
        user_icon: user ? user.icon_url : null
      };
    });
    
    res.json(commentsWithUserData);
  } catch (err) {
    console.error('コメント取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// コメント投稿
app.post('/comments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { post_id, text } = req.body;
    
    if (!post_id || !text) {
      return res.status(400).json({ error: '投稿IDとコメント内容が必要です' });
    }
    
    const data = await readData();
    const userData = await readUserData();
    
    // コメント配列の初期化チェック
    if (!Array.isArray(data.comments)) {
      data.comments = [];
    }
    
    // ユーザー情報を取得
    const user = userData.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    // 新しいコメントを作成
    const newComment = {
      id: data.comments.length > 0 ? Math.max(...data.comments.map(c => c.id)) + 1 : 1,
      post_id,
      user_id: userId,
      text,
      created_at: new Date().toISOString()
    };
    
    data.comments.push(newComment);
    await writeData(data);
    
    // レスポンスにユーザー情報を追加
    const commentWithUser = {
      ...newComment,
      username: user.username,
      user_icon: user.icon_url
    };
    
    res.status(201).json(commentWithUser);
  } catch (err) {
    console.error('コメント投稿エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ブックマーク関連API
// ブックマークチェック
app.get('/check-bookmark/:postId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = parseInt(req.params.postId);
    
    const data = await readData();
    
    // ブックマーク配列の初期化チェック
    if (!Array.isArray(data.bookmarks)) {
      data.bookmarks = [];
    }
    
    // ユーザーがこの投稿をブックマークしているかチェック
    const hasBookmarked = data.bookmarks.some(bookmark => 
      bookmark.user_id === userId && bookmark.post_id === postId
    );
    
    res.json({ bookmarked: hasBookmarked });
  } catch (err) {
    console.error('ブックマークチェックエラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ブックマーク追加API
app.post('/bookmarks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { post_id } = req.body;
    
    if (!post_id) {
      return res.status(400).json({ error: '投稿IDが必要です' });
    }
    
    const data = await readData();
    
    // 配列初期化
    if (!Array.isArray(data.bookmarks)) {
      data.bookmarks = [];
    }
    
    // 既にブックマークがあるか確認
    const existingBookmark = data.bookmarks.find(bookmark => 
      bookmark.user_id === userId && bookmark.post_id === post_id
    );
    
    if (existingBookmark) {
      return res.status(400).json({ error: '既にブックマークしています' });
    }
    
    // 新しいブックマークを追加
    const newBookmark = {
      id: data.bookmarks.length > 0 ? Math.max(...data.bookmarks.map(b => b.id)) + 1 : 1,
      user_id: userId,
      post_id: post_id,
      created_at: new Date().toISOString()
    };
    
    data.bookmarks.push(newBookmark);
    
    // 投稿のブックマーク数を更新
    const post = data.posts.find(p => p.id === post_id);
    if (post) {
      post.bookmarkCount = (post.bookmarkCount || 0) + 1;
    }
    
    await writeData(data);
    
    res.status(201).json(newBookmark);
  } catch (err) {
    console.error('ブックマーク追加エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ブックマーク削除API
app.delete('/bookmarks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { post_id } = req.body;
    
    if (!post_id) {
      return res.status(400).json({ error: '投稿IDが必要です' });
    }
    
    const data = await readData();
    
    // ブックマーク配列の初期化チェック
    if (!Array.isArray(data.bookmarks)) {
      return res.status(404).json({ error: 'ブックマークが見つかりません' });
    }
    
    // ブックマークのインデックスを検索
    const bookmarkIndex = data.bookmarks.findIndex(bookmark => 
      bookmark.user_id === userId && bookmark.post_id === post_id
    );
    
    if (bookmarkIndex === -1) {
      return res.status(404).json({ error: 'ブックマークが見つかりません' });
    }
    
    // ブックマークを削除
    data.bookmarks.splice(bookmarkIndex, 1);
    
    // 投稿のブックマーク数を更新
    const post = data.posts.find(p => p.id === post_id);
    if (post && post.bookmarkCount > 0) {
      post.bookmarkCount--;
    }
    
    await writeData(data);
    
    res.json({ message: 'ブックマークを削除しました' });
  } catch (err) {
    console.error('ブックマーク削除エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ブックマークした投稿を取得するエンドポイント - 確実にフィルタリングする
app.get('/bookmarked-posts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`ユーザー${userId}のブックマーク投稿を取得`);
    
    const data = await readData();
    
    // ブックマーク配列の初期化チェック
    if (!Array.isArray(data.bookmarks)) {
      data.bookmarks = [];
      await writeData(data);
      return res.json([]);
    }
    
    // このユーザーがブックマークした投稿IDを取得
    const bookmarkedPostIds = data.bookmarks
      .filter(bookmark => bookmark.user_id === userId)
      .map(bookmark => bookmark.post_id);
    
    console.log(`ユーザー${userId}がブックマークした投稿ID: `, bookmarkedPostIds);
    
    // 投稿配列の初期化チェック
    if (!Array.isArray(data.posts)) {
      return res.json([]);
    }
    
    // ブックマークした投稿だけを厳密にフィルタリング
    const bookmarkedPosts = data.posts.filter(post => 
      bookmarkedPostIds.includes(post.id)
    );
    
    console.log(`ブックマーク投稿: ${bookmarkedPosts.length}件`);
    
    // ユーザー情報を付加
    const userData = await readUserData();
    const postsWithUserInfo = bookmarkedPosts.map(post => {
      const user = userData.users.find(u => u.id === post.user_id);
      
      return {
        ...post,
        username: user ? user.username : `ユーザー${post.user_id}`,
        user_icon: user ? user.icon_url : null
      };
    });
    
    res.json(postsWithUserInfo);
  } catch (err) {
    console.error('ブックマーク投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// タグでフィルタリングされた投稿を取得するエンドポイント - 改善版
app.get('/posts-by-tag/:tagName', async (req, res) => {
  try {
    const tagName = decodeURIComponent(req.params.tagName).toLowerCase();
    console.log(`タグ「${tagName}」の投稿をフィルタリング`);
    
    const data = await readData();
    
    // タグでフィルタリング
    const filteredPosts = data.posts.filter(post => 
      Array.isArray(post.tags) && 
      post.tags.some(tag => tag.toLowerCase() === tagName.toLowerCase())
    );
    
    console.log(`タグ「${tagName}」の投稿: ${filteredPosts.length}件`);
    
    // 投稿日時の降順でソート
    filteredPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // ユーザー情報を付加
    const userData = await readUserData();
    const postsWithUserInfo = filteredPosts.map(post => {
      const user = userData.users.find(u => u.id === post.user_id);
      
      return {
        ...post,
        username: user ? user.username : `ユーザー${post.user_id}`,
        user_icon: user ? user.icon_url : null
      };
    });
    
    res.json(postsWithUserInfo);
  } catch (err) {
    console.error('タグ別投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// すべての他のリクエストをindex.htmlにリダイレクト（SPAルーティング用）
// ※必ず他のルートの最後に配置
app.get('*', (req, res) => {
  // APIリクエストの場合は処理しない
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return res.status(404).json({ error: 'APIエンドポイントが見つかりません' });
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 大容量ファイルのアップロード用の一時ディレクトリ
const tempUploadsDir = path.join(__dirname, 'temp_uploads');
if (!fsSync.existsSync(tempUploadsDir)) {  // fsSync を使用
  fsSync.mkdirSync(tempUploadsDir, { recursive: true });
}

// アップロードセッションの管理
const uploadSessions = {};

// アップロードセッション開始エンドポイント
app.post('/upload-session', authenticateToken, async (req, res) => {
  try {
    const { filename, fileType, fileSize, sessionId, totalChunks } = req.body;
    
    if (!filename || !fileType || !fileSize || !sessionId || !totalChunks) {
      return res.status(400).json({ error: '不正なリクエストパラメータ' });
    }
    
    console.log(`アップロードセッション開始 (ユーザーID: ${req.user.id}): ${sessionId}, ファイル: ${filename}, サイズ: ${fileSize}バイト`);
    
    // ユーザー固有のセッションディレクトリを作成
    const userId = req.user.id;
    const sessionDir = path.join(tempUploadsDir, `${userId}_${sessionId}`);
    
    if (!fsSync.existsSync(sessionDir)) {
      fsSync.mkdirSync(sessionDir, { recursive: true });
    }
    
    // セッション情報を保存
    uploadSessions[sessionId] = {
      userId,
      filename,
      fileType,
      fileSize: parseInt(fileSize),
      totalChunks: parseInt(totalChunks),
      receivedChunks: 0,
      chunkStatus: Array(parseInt(totalChunks)).fill(false),
      sessionDir,
      createdAt: new Date()
    };
    
    console.log(`セッション ${sessionId} 作成完了、${totalChunks}チャンク待機中`);
    res.json({ success: true, message: 'アップロードセッションが作成されました' });
  } catch (error) {
    console.error('アップロードセッション作成エラー:', error);
    res.status(500).json({ error: 'セッション作成に失敗しました: ' + error.message });
  }
});

// チャンクアップロードエンドポイント - 修正版
app.post('/upload-chunk', authenticateToken, async (req, res) => {
  // まずmulterミドルウェアをセットアップ
  const uploadMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const sessionId = req.body.sessionId;
        
        // セッションIDの検証を追加
        if (!sessionId || !uploadSessions[sessionId]) {
          console.error(`セッションIDが無効: ${sessionId}`);
          return cb(new Error('無効なセッションID'));
        }
        
        const session = uploadSessions[sessionId];
        cb(null, session.sessionDir);
      },
      filename: (req, file, cb) => {
        const chunkIndex = req.body.chunkIndex;
        cb(null, `chunk_${chunkIndex}`);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 各チャンク10MB上限
  }).single('chunk');

  // multerミドルウェアを実行
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('チャンクアップロードエラー:', err);
      return res.status(500).json({ error: err.message });
    }
    
    // デバッグログの追加
    console.log('チャンクアップロードリクエスト受信:');
    console.log('- Body:', req.body);
    console.log('- File:', req.file ? 'ファイル有り' : 'ファイル無し');
    
    const sessionId = req.body.sessionId;
    const chunkIndex = req.body.chunkIndex;
    const totalChunks = req.body.totalChunks;
    
    if (!sessionId) {
      console.error('セッションIDがありません');
      return res.status(400).json({ error: 'セッションIDが必要です' });
    }
    
    const session = uploadSessions[sessionId];
    
    if (!session) {
      // セッション情報の詳細をデバッグ表示
      console.error(`セッション ${sessionId} が見つかりません`);
      console.log('現在のセッション一覧:', Object.keys(uploadSessions));
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }
    
    // チャンクステータスを更新
    const index = parseInt(chunkIndex);
    session.chunkStatus[index] = true;
    session.receivedChunks++;
    
    console.log(`セッション ${sessionId}: チャンク ${parseInt(chunkIndex) + 1}/${totalChunks} 受信済み`);
    
    res.json({ 
      success: true, 
      receivedChunks: session.receivedChunks, 
      totalChunks: parseInt(totalChunks) 
    });
  });
});

// アップロード完了処理
app.post('/upload-session/complete', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  const session = uploadSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }
  
  // すべてのチャンクが揃っているか確認
  if (session.receivedChunks !== parseInt(session.totalChunks)) {
    return res.status(400).json({ 
      error: `チャンクが不足しています (${session.receivedChunks}/${session.totalChunks})` 
    });
  }
  
  try {
    console.log(`セッション ${sessionId}: すべてのチャンクを結合中...`);
    
    // 最終的なファイル名を決定
    const fileName = `${Date.now()}-${session.filename.replace(/\s+/g, '-')}`;
    const filePath = `uploads/${fileName}`;
    
    // チャンクを結合
    const isVideo = session.fileType.startsWith('video/');
    const fileExtension = isVideo ? '.mp4' : '.jpg';
    const finalFileName = `${session.userId}_${Date.now()}${fileExtension}`;
    const finalLocalPath = path.join(tempUploadsDir, finalFileName);
    
    // ファイルストリーム作成
    const outputStream = fsSync.createWriteStream(finalLocalPath);
    
    // チャンクを順番に結合
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.sessionDir, `chunk_${i}`);
      
      await new Promise((resolve, reject) => {
        const chunkStream = fsSync.createReadStream(chunkPath);
        chunkStream.pipe(outputStream, { end: false });
        chunkStream.on('end', resolve);
        chunkStream.on('error', reject);
      });
      
      // 処理済みのチャンクを削除
      fsSync.unlinkSync(chunkPath);
    }
    
    // すべてのチャンクの書き込み完了
    outputStream.end();
    
    await new Promise((resolve) => {
      outputStream.on('finish', resolve);
    });
    
    console.log(`セッション ${sessionId}: チャンク結合完了`);
    
    // Cloud Storageにアップロード
    const file = bucket.file(filePath);
    const fileBuffer = fsSync.readFileSync(finalLocalPath);
    
    await new Promise((resolve, reject) => {
      const blobStream = file.createWriteStream({
        metadata: {
          contentType: session.fileType
        },
        resumable: false
      });
      
      blobStream.on('finish', resolve);
      blobStream.on('error', reject);
      blobStream.end(fileBuffer);
    });
    
    // 公開URL生成
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
    
    console.log(`セッション ${sessionId}: Cloud Storageへのアップロード完了`);
    
    // ローカルの一時ファイルを削除
    fsSync.unlinkSync(finalLocalPath);
    fsSync.rmdirSync(session.sessionDir, { recursive: true });
    
    // セッション情報を更新して保存（アップロード情報APIのために必要）
    session.status = 'completed';
    session.completedAt = new Date();
    session.filePath = filePath;
    session.publicUrl = publicUrl;
    session.isVideo = isVideo;
    
    // 成功レスポンス
    res.json({ 
      imageUrl: publicUrl, 
      isVideo: isVideo,
      filePath: filePath,
      fileName: fileName
    });
    
    // セッション情報は一定時間保持して、ファイル情報確認APIで使えるようにする
    setTimeout(() => {
      delete uploadSessions[sessionId];
    }, 30 * 60 * 1000); // 30分後に削除
    
  } catch (error) {
    console.error(`セッション ${sessionId} 完了エラー:`, error);
    
    // エラー時にも一時ファイルを削除
    try {
      fsSync.rmdirSync(session.sessionDir, { recursive: true });
    } catch (cleanupError) {
      console.error('一時ファイル削除エラー:', cleanupError);
    }
    
    delete uploadSessions[sessionId];
    res.status(500).json({ error: 'ファイル処理中にエラーが発生しました' });
  }
});

// 新規: アップロードファイル情報取得エンドポイント
app.get('/upload-info/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`アップロード情報リクエスト: ${sessionId}`);
    
    // アップロードセッション情報から確認
    const session = uploadSessions[sessionId];
    
    if (session && session.status === 'completed' && session.publicUrl) {
      console.log(`セッション情報から取得: ${sessionId} -> ${session.publicUrl}`);
      return res.json({
        url: session.publicUrl,
        isVideo: session.isVideo,
        fileName: session.filename,
        filePath: session.filePath,
        status: 'completed'
      });
    }
    
    // Cloud Storageで可能性があるパスを確認
    const possiblePaths = [
      `uploads/${sessionId}.mp4`,
      `uploads/${sessionId}.jpg`,
      `uploads/${sessionId}.png`,
      `uploads/${sessionId}.gif`,
      `uploads/${sessionId}.webp`,
      `uploads/${sessionId}-*`, // ワイルドカード検索
    ];
    
    for (const pathPattern of possiblePaths) {
      try {
        const [files] = await bucket.getFiles({ prefix: pathPattern.replace('*', '') });
        
        if (files && files.length > 0) {
          // 最新のファイルを選択
          const file = files[0]; // 通常は1つだけのはず
          await file.makePublic();
          
          const publicUrl = `https://storage.googleapis.com/${bucketName}/${file.name}`;
          console.log(`Cloud Storageから発見: ${sessionId} -> ${publicUrl}`);
          
          return res.json({
            url: publicUrl,
            fileName: file.name.split('/').pop(),
            filePath: file.name,
            isVideo: file.name.endsWith('.mp4') || file.name.endsWith('.webm'),
            status: 'found_in_storage'
          });
        }
      } catch (err) {
        console.log(`パターン ${pathPattern} の検索でエラー:`, err.message);
      }
    }
    
    // ファイルが見つからない
    console.log(`ファイル情報が見つかりません: ${sessionId}`);
    res.status(404).json({ error: 'ファイル情報が見つかりません' });
    
  } catch (error) {
    console.error('ファイル情報取得エラー:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

// file-info エンドポイントも追加（代替パス）
app.get('/file-info', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionIdが必要です' });
    }
    
    console.log(`ファイル情報リクエスト(代替パス): ${sessionId}`);
    
    // upload-info エンドポイントにリダイレクト
    const uploadInfoResponse = await new Promise(resolve => {
      const mockRes = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.data = data;
          resolve(this);
        }
      };
      app._router.handle({ 
        path: `/upload-info/${sessionId}`, 
        method: 'GET',
        query: {}, 
        params: { sessionId }
      }, mockRes);
    });
    
    if (uploadInfoResponse.statusCode === 200) {
      return res.json(uploadInfoResponse.data);
    } else {
      return res.status(uploadInfoResponse.statusCode).json(uploadInfoResponse.data);
    }
  } catch (error) {
    console.error('ファイル情報取得エラー (代替):', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

// file-metadata エンドポイント（もう一つの代替パス）
app.get('/file-metadata/:sessionId', async (req, res) => {
  try {
    const uploadInfoRes = await new Promise(resolve => {
      const mockRes = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.data = data;
          resolve(this);
        }
      };
      app._router.handle({ 
        path: `/upload-info/${req.params.sessionId}`, 
        method: 'GET', 
        query: {}, 
        params: { sessionId: req.params.sessionId }
      }, mockRes);
    });
    
    if (uploadInfoRes.statusCode === 200) {
      return res.json(uploadInfoRes.data);
    } else {
      return res.status(uploadInfoRes.statusCode).json(uploadInfoRes.data);
    }
  } catch (error) {
    console.error('ファイル情報取得エラー (代替2):', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

// 古いアップロードセッションをクリーンアップする定期実行タスク
setInterval(() => {
  const now = new Date();
  const sessionTimeoutMs = 24 * 60 * 60 * 1000; // 24時間
  
  for (const [sessionId, session] of Object.entries(uploadSessions)) {
    const sessionAge = now - new Date(session.createdAt);
    
    if (sessionAge > sessionTimeoutMs) {
      console.log(`古いセッション ${sessionId} を削除します`);
      
      try {
        fsSync.rmdirSync(session.sessionDir, { recursive: true });
      } catch (error) {
        console.error(`セッション ${sessionId} クリーンアップエラー:`, error);
      }
      
      delete uploadSessions[sessionId];
    }
  }
}, 3600000); // 1時間ごとに実行

// ユーザープロフィール更新API
app.put('/user/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, avatar } = req.body;
    
    console.log(`プロフィール更新: userId=${userId}, username=${username}, avatar=${avatar ? avatar.substring(0, 30) + '...' : 'なし'}`);
    
    if (!username) {
      return res.status(400).json({ error: 'ユーザー名は必須です' });
    }
    
    const userData = await readUserData();
    const userIndex = userData.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    // ユーザー情報を更新
    userData.users[userIndex].username = username;
    
    // アバター画像のURLが指定された場合は更新
    if (avatar !== undefined) {
      userData.users[userIndex].icon_url = avatar;
    }
    
    await writeUserData(userData);
    
    // パスワードを除外したユーザー情報を返す
    const { password, ...userWithoutPassword } = userData.users[userIndex];
    
    console.log(`プロフィール更新成功: userId=${userId}`);
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('プロフィール更新エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました: ' + err.message });
  }
});

// ユーザーの投稿を取得する API エンドポイント
app.get('/user/:userId/posts', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`ユーザーID ${userId} の投稿をページ ${page}、リミット ${limit} で取得中`);
    
    const data = await readData();
    
    // ユーザーの投稿をフィルタリング
    let userPosts = [];
    if (Array.isArray(data.posts)) {
      userPosts = data.posts
        .filter(post => post.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // 降順にソート
    } else {
      console.warn('データの posts フィールドが配列ではありません:', data);
    }
    
    console.log(`ユーザーID ${userId} の投稿が ${userPosts.length} 件見つかりました`);
    
    // ページネーション
    const startIndex = (page - 1) * limit;
    const paginatedPosts = userPosts.slice(startIndex, startIndex + limit);
    
    // 互換性のため配列として返す
    res.json(paginatedPosts);
  } catch (err) {
    console.error('ユーザー投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// もう一つの互換性のためのエンドポイント（一部のフロントエンドは /api プレフィックスを使用）
app.get('/api/user/:userId/posts', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`/api エンドポイント: ユーザーID ${userId} の投稿を取得中`);
    
    const data = await readData();
    
    // ユーザーの投稿をフィルタリング
    let userPosts = [];
    if (Array.isArray(data.posts)) {
      userPosts = data.posts
        .filter(post => post.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // 降順にソート
    }
    
    // ページネーション
    const startIndex = (page - 1) * limit;
    const paginatedPosts = userPosts.slice(startIndex, startIndex + limit);
    
    res.json(paginatedPosts);
  } catch (err) {
    console.error('ユーザー投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 投稿を削除する API エンドポイント
app.delete('/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.id;
    
    console.log(`ユーザーID ${userId} が投稿ID ${postId} を削除しようとしています`);
    
    const data = await readData();
    
    // 投稿を見つける
    const postIndex = data.posts.findIndex(post => post.id === postId);
    
    if (postIndex === -1) {
      console.log(`投稿ID ${postId} が見つかりません`);
      return res.status(404).json({ error: '投稿が見つかりません' });
    }
    
    // 投稿の所有者かどうか確認
    if (data.posts[postIndex].user_id !== userId) {
      console.log(`権限エラー: ユーザーID ${userId} は投稿ID ${postId} の所有者ではありません`);
      return res.status(403).json({ error: '他のユーザーの投稿は削除できません' });
    }
    
    // 投稿を削除
    const deletedPost = data.posts.splice(postIndex, 1)[0];
    await writeData(data);
    
    console.log(`投稿ID ${postId} を削除しました`);
    res.json({ message: '投稿が削除されました', post: deletedPost });
  } catch (err) {
    console.error('投稿削除エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ユーザーの投稿を取得するAPI（フロントエンドが使用している形式に合わせる）
app.get('/user/:userId/posts', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`ユーザーID ${userId} の投稿をページ ${page}、リミット ${limit} で取得中`);
    
    const data = await readData();
    
    // データの存在確認
    if (!data || !Array.isArray(data.posts)) {
      console.warn(`データ構造が不正: posts配列がありません`);
      return res.json([]);
    }
    
    // ユーザーの投稿をフィルタリング
    const userPosts = data.posts
      .filter(post => post.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // 新しい順にソート
    
    console.log(`ユーザーID ${userId} の投稿が ${userPosts.length} 件見つかりました`);
    
    // ページネーション
    const startIndex = (page - 1) * limit;
    const paginatedPosts = userPosts.slice(startIndex, startIndex + limit);
    
    // APIの一貫性のため配列で返す
    res.json(paginatedPosts);
  } catch (err) {
    console.error('ユーザー投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// もう一つの可能性のあるパス形式のエンドポイントも追加（代替パス）
app.get('/posts/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`代替パス: ユーザーID ${userId} の投稿を取得中`);
    
    const data = await readData();
    
    if (!data || !Array.isArray(data.posts)) {
      return res.json([]);
    }
    
    const userPosts = data.posts
      .filter(post => post.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const startIndex = (page - 1) * limit;
    const paginatedPosts = userPosts.slice(startIndex, startIndex + limit);
    
    res.json(paginatedPosts);
  } catch (err) {
    console.error('代替パスでの投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ログイン中のユーザー自身の投稿を取得（認証付き）
app.get('/user/posts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`認証済みユーザーID ${userId} の投稿をページ ${page} で取得中`);
    
    const data = await readData();
    
    if (!data || !Array.isArray(data.posts)) {
      return res.json([]);
    }
    
    const userPosts = data.posts
      .filter(post => post.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const startIndex = (page - 1) * limit;
    const paginatedPosts = userPosts.slice(startIndex, startIndex + limit);
    
    res.json(paginatedPosts);
  } catch (err) {
    console.error('自分の投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ユーザーの投稿を取得するAPI（様々なパスパターンに対応）
app.get(['/user/:userId/posts', '/api/user/:userId/posts', '/posts/user/:userId'], async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`ユーザーID ${userId} の投稿をページ ${page}、リミット ${limit} で取得中`);
    
    const data = await readData();
    
    // データの存在確認
    if (!data || !Array.isArray(data.posts)) {
      console.warn(`データ構造が不正: posts配列がありません`);
      return res.json([]);
    }
    
    // ユーザーの投稿をフィルタリング
    const userPosts = data.posts
      .filter(post => post.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // 新しい順にソート
    
    console.log(`ユーザーID ${userId} の投稿が ${userPosts.length} 件見つかりました`);
    
    // ページネーション
    const startIndex = (page - 1) * limit;
    const paginatedPosts = userPosts.slice(startIndex, startIndex + limit);
    
    // APIの一貫性のため配列で返す
    res.json(paginatedPosts);
  } catch (err) {
    console.error('ユーザー投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ログイン中のユーザー自身の投稿を取得（認証付き）- /user/posts パス向け
app.get('/user/posts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`認証済みユーザーID ${userId} の投稿をページ ${page} で取得中`);
    
    const data = await readData();
    
    if (!data || !Array.isArray(data.posts)) {
      return res.json([]);
    }
    
    const userPosts = data.posts
      .filter(post => post.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const startIndex = (page - 1) * limit;
    const paginatedPosts = userPosts.slice(startIndex, startIndex + limit);
    
    res.json(paginatedPosts);
  } catch (err) {
    console.error('自分の投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// Resumable Uploadsセッション情報を保存するオブジェクト
const resumableSessions = {};

// Resumable Upload用のURLを生成するエンドポイント
app.post('/create-resumable-upload', authenticateToken, async (req, res) => {
  try {
    const { filename, fileType, fileSize } = req.body;
    
    if (!filename || !fileType) {
      return res.status(400).json({ error: 'ファイル名とファイルタイプは必須です' });
    }
    
    console.log(`Resumable Upload開始リクエスト: ${filename}, タイプ: ${fileType}, サイズ: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`);
    
    // セッションIDを生成
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Cloud Storageへのパス
    const filePath = `uploads/${sessionId}-${filename.replace(/\s+/g, '-')}`;
    
    try {
      // Resumable Uploadの初期化
      const [resumableUrl] = await bucket.file(filePath).createResumableUpload({
        metadata: {
          contentType: fileType,
        },
        origin: '*' // CORSの設定
      });
      
      // セッション情報を保存
      resumableSessions[sessionId] = {
        userId: req.user.id,
        filename,
        fileType,
        filePath,
        createdAt: new Date(),
        status: 'created'
      };
      
      console.log(`Resumable Upload URL生成成功: ${sessionId}`);
      
      // クライアントにURLとセッションIDを返す
      res.json({
        uploadUrl: resumableUrl,
        sessionId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } catch (error) {
      console.error('Resumable Upload URL生成エラー:', error);
      res.status(500).json({ error: 'アップロードURLの生成に失敗しました: ' + error.message });
    }
  } catch (error) {
    console.error('Resumable Uploadセッション作成エラー:', error);
    res.status(500).json({ error: '内部サーバーエラー: ' + error.message });
  }
});

// Resumable Upload完了処理エンドポイント
app.post('/finalize-upload/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // セッション情報の検証
    const session = resumableSessions[sessionId];
    if (!session) {
      return res.status(404).json({ error: 'アップロードセッションが見つかりません' });
    }
    
    // ユーザーIDの検証
    if (session.userId !== req.user.id) {
      return res.status(403).json({ error: '不正なセッションアクセス' });
    }
    
    console.log(`Resumable Upload完了リクエスト: ${sessionId}, ファイル: ${session.filePath}`);
    
    // ファイルの存在確認
    const file = bucket.file(session.filePath);
    const [exists] = await file.exists();
    
    if (!exists) {
      return res.status(404).json({ error: 'アップロードされたファイルが見つかりません' });
    }
    
    // ファイルを公開設定に
    try {
      await file.makePublic();
    } catch (err) {
      console.warn('ファイル公開設定スキップ:', err.message);
      // エラーは無視して続行
    }
    
    // 公開URL生成
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${session.filePath}`;
    
    // 成功レスポンス
    res.json({
      imageUrl: publicUrl,
      isVideo: session.fileType.startsWith('video/'),
      filePath: session.filePath
    });
    
    // セッション情報をアップデート
    session.status = 'completed';
    session.completedAt = new Date();
    session.publicUrl = publicUrl;
    
    // 一定時間後にセッション情報を削除（メモリリーク防止）
    setTimeout(() => {
      delete resumableSessions[sessionId];
    }, 60 * 60 * 1000); // 1時間後
    
  } catch (error) {
    console.error('アップロード完了処理エラー:', error);
    res.status(500).json({ error: '内部サーバーエラー: ' + error.message });
  }
});

// Resumable Uploadキャンセル
app.delete('/cancel-upload/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = resumableSessions[sessionId];
    
    if (!session) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }
    
    if (session.userId !== req.user.id) {
      return res.status(403).json({ error: '不正なセッションアクセス' });
    }
    
    // アップロード中のファイルを削除
    try {
      const file = bucket.file(session.filePath);
      const [exists] = await file.exists();
      
      if (exists) {
        await file.delete();
      }
    } catch (error) {
      console.warn('アップロードファイル削除エラー:', error);
    }
    
    // セッション情報を削除
    delete resumableSessions[sessionId];
    
    res.json({ success: true, message: 'アップロードがキャンセルされました' });
  } catch (error) {
    console.error('アップロードキャンセルエラー:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

// 古いアップロードセッションをクリーンアップする定期実行タスク
setInterval(() => {
  const now = new Date();
  const sessionTimeout = 24 * 60 * 60 * 1000; // 24時間
  
  // Resumable Uploadセッションのクリーンアップ
  for (const [sessionId, session] of Object.entries(resumableSessions)) {
    const sessionAge = now - new Date(session.createdAt);
    
    if (sessionAge > sessionTimeout) {
      console.log(`古いResumableアップロードセッション ${sessionId} を削除します`);
      
      // 未完了のファイルがあれば削除
      try {
        if (session.status !== 'completed') {
          const file = bucket.file(session.filePath);
          file.delete().catch(err => {
            console.warn(`ファイル削除エラー (${session.filePath}):`, err);
          });
        }
      } catch (error) {
        console.error(`セッション ${sessionId} クリーンアップエラー:`, error);
      }
      
      delete resumableSessions[sessionId];
    }
  }
}, 3600000); // 1時間ごとに実行

// サーバー起動時にデータ構造を確認
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
  console.log('利用可能なエンドポイント:');
  console.log('- 認証関連:');
  console.log('  POST /login, POST /auth/login: ログイン');
  console.log('  POST /register, POST /auth/register: ユーザー登録');
  console.log('  GET /auth/me: 現在のユーザー情報取得');
  console.log('- 投稿関連:');
  console.log('  GET /posts, GET /api/photos: 投稿一覧取得');
  console.log('  POST /posts: 新規投稿');
  console.log('  POST /upload: メディアアップロード');
  
  try {
    // バケットアクセス確認 (エラーでもサーバー起動は続行)
    if (!bucket) {
      console.error('警告: バケットオブジェクトが初期化されていません');
      return;
    }

    console.log('Cloud Storageバケットのアクセス確認中...');
    
    try {
      // バケット情報を取得（アクセス権限の確認）
      const [bucketInfo] = await bucket.getMetadata();
      console.log(`バケット名: ${bucketInfo.name}, 作成日: ${bucketInfo.timeCreated}`);

      // Cloud Storageに初期データファイルが存在するか確認
      const [dataFileExists] = await bucket.file(dataFilePath).exists();
      const [userDataFileExists] = await bucket.file(userDataFilePath).exists();
      
      console.log(`データファイルの存在確認: PhotoData.json=${dataFileExists}, UserData.json=${userDataFileExists}`);
      
      // データファイルがない場合は初期データを作成
      if (!dataFileExists) {
        console.log('PhotoData.jsonが存在しないため初期化します');
        await writeData({ users: [], posts: [], likes: [], bookmarks: [], comments: [], tags: [] });
      }
      
      if (!userDataFileExists) {
        console.log('UserData.jsonが存在しないため初期化します');
        await writeUserData({ users: [] });
      }
      
      console.log('データファイル確認完了、サーバー準備完了');
    } catch (checkErr) {
      console.error('バケット接続確認エラー:', checkErr);
      console.log('バケット接続エラーがありますが、サーバー起動は続行します');
    }
  } catch (err) {
    console.error('データ構造確認エラー:', err);
    console.error('警告: データファイルの初期化に失敗しましたが、サーバーは起動します');
  }
});
