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
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: path.join(__dirname, 'gcp-key.json')
});
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'sharechat-media-bucket';
const bucket = storage.bucket(bucketName);

const app = express();
// Cloud Storage内のJSONファイルパス設定
const dataFilePath = 'data/PhotoData.json';
const userDataFilePath = 'data/UserData.json';

// JWT秘密鍵の環境変数から取得
const JWT_SECRET = process.env.JWT_SECRET || 'sharechat_app_secret_key_1234567890';

app.use(cors());
app.use(express.json());

// ファイル読み書き用ヘルパー関数 - Cloud Storage対応
async function readGCSFile(filePath) {
  try {
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
    
    const [content] = await file.download();
    return JSON.parse(content.toString());
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
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
      
      // Cloud Storageにアップロード
      const file = bucket.file(filePath);
      const passthroughStream = new stream.PassThrough();
      passthroughStream.write(fileBuffer);
      passthroughStream.end();
      
      passthroughStream.pipe(file.createWriteStream({
        metadata: {
          contentType: req.file.mimetype,
        },
        public: true,
      }));
      
      // 公開URL生成
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
      
      // ファイルタイプ（画像または動画）を判別
      const isVideo = req.file.mimetype.startsWith('video/');
      
      res.json({ 
        imageUrl: publicUrl,
        isVideo: isVideo
      });
    } catch (error) {
      console.error('ファイルアップロードエラー:', error);
      res.status(500).json({ error: 'ファイルのアップロードに失敗しました' });
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

// 🔹 ユーザー登録 API - アイコンアップロード対応に修正
app.post('/register', upload.single('icon'), async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: '全てのフィールドが必要です' });
  }

  const userData = await readUserData();

  // 同じメールアドレスがないか重複チェック
  if (userData.users.some(user => user.email === email)) {
    return res.status(400).json({ error: '既に登録されています' });
  }

  try {
    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // アイコン画像のURL処理
    let iconUrl = null;
    if (req.file) {
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
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
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

// server.js に追加
app.get('/', (req, res) => {
  res.json({ message: "ShareChat API Server is running" });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: "ShareChat API Health Check OK" });
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

// 投稿一覧取得API
app.get('/api/photos', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.posts);
  } catch (err) {
    console.error('投稿一覧取得エラー:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// サーバー起動時にデータ構造を確認
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  try {
    // Cloud Storageに初期データファイルが存在するか確認
    const [dataFileExists] = await bucket.file(dataFilePath).exists();
    const [userDataFileExists] = await bucket.file(userDataFilePath).exists();
    
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
  }
});
