import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Storage } from '@google-cloud/storage';
import stream from 'stream';

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
      id: userData.users.length ? userData.users[userData.users.length - 1].id + 1 : 1,
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
      id: userData.users.length ? userData.users[userData.users.length - 1].id + 1 : 1,
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

// ブックマークした投稿を取得するエンドポイント
app.get('/bookmarked-posts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
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
    
    // 投稿配列の初期化チェック
    if (!Array.isArray(data.posts)) {
      return res.json([]);
    }
    
    // ブックマークした投稿を取得
    const bookmarkedPosts = data.posts.filter(post => 
      bookmarkedPostIds.includes(post.id)
    );
    
    // ブックマーク順にソート（新しい順）
    bookmarkedPosts.sort((a, b) => {
      const bookmarkA = data.bookmarks.find(
        bookmark => bookmark.user_id === userId && bookmark.post_id === a.id
      );
      const bookmarkB = data.bookmarks.find(
        bookmark => bookmark.user_id === userId && bookmark.post_id === b.id
      );
      
      return new Date(bookmarkB.created_at) - new Date(bookmarkA.created_at);
    });
    
    res.json(bookmarkedPosts);
  } catch (err) {
    console.error('ブックマーク投稿取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// タグでフィルタリングされた投稿を取得するエンドポイント
app.get('/posts-by-tag/:tagName', async (req, res) => {
  try {
    const tagName = req.params.tagName.toLowerCase();
    console.log(`タグ「${tagName}」の投稿をフィルタリング`);
    
    const data = await readData();
    
    // タグでフィルタリング
    const filteredPosts = data.posts.filter(post => 
      Array.isArray(post.tags) && 
      post.tags.some(tag => tag.toLowerCase() === tagName)
    );
    
    // 投稿日時の降順でソート
    filteredPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // ユーザー情報を付加
    const postsWithUserInfo = await Promise.all(filteredPosts.map(async (post) => {
      // ユーザーデータを取得
      const userData = await readUserData();
      const user = userData.users.find(u => u.id === post.user_id);
      
      return {
        ...post,
        username: user ? user.username : `ユーザー${post.user_id}`,
        user_icon: user ? user.icon_url : null
      };
    }));
    
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
    // バケットアクセス確認
    if (!bucket) {
      console.error('警告: バケットオブジェクトが初期化されていません');
      return;
    }

    console.log('Cloud Storageバケットのアクセス確認中...');
    
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
    
    console.log('データファイル確認完了、サーバー起動準備完了');
  } catch (err) {
    console.error('データ構造確認エラー:', err);
    console.error('警告: データファイルの初期化に失敗しましたが、サーバーは起動します');
  }
});
