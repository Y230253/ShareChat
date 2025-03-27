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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// 修正: dataFile のパスを PhotoData.json に変更
const dataFile = path.join(__dirname, 'PhotoData.json');

// 追加: ユーザーデータ用のファイルパスとヘルパー関数
const userDataFile = path.join(__dirname, 'UserData.json');

async function readUserData() {
  try {
    const content = await fs.readFile(userDataFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const defaultData = { users: [] };
      await writeUserData(defaultData);
      return defaultData;
    }
    throw error;
  }
}
async function writeUserData(data) {
  await fs.writeFile(userDataFile, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());

// USB HDD に保存するための設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'D:/uploads/'); // USB HDD のパス
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// ファイルフィルター - 画像と動画の両方を許可
const fileFilter = (req, file, cb) => {
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
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB上限
  }
});

// 画像・動画アップロードAPIのエラーハンドリングを追加
app.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({ error: err.message || 'アップロードに失敗しました' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }
    
    // ファイルタイプ（画像または動画）を判別
    const isVideo = req.file.mimetype.startsWith('video/');
    
    res.json({ 
      imageUrl: `/uploads/${req.file.filename}`,
      isVideo: isVideo
    });
  });
});
app.use('/uploads', express.static('D:/uploads'));

// Helper: JSONファイルの読み書き
async function readData() {
  try {
    const content = await fs.readFile(dataFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // ファイルが存在しない場合、初期構造で作成
      const defaultData = { users: [], posts: [], likes: [], bookmarks: [], comments: [] };
      await writeData(defaultData);
      return defaultData;
    }
    throw error;
  }
}
async function writeData(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

// JWT秘密鍵の設定 - 直接値を設定してデバッグ
const JWT_SECRET = 'sharechat_app_secret_key_1234567890';

// 追加: 認証ミドルウェア
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

// 🔹 ユーザー登録 API（JSON版）
app.post('/register', async (req, res) => {
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
    const newUser = {
      id: userData.users.length ? userData.users[userData.users.length - 1].id + 1 : 1,
      username,
      email,
      password: hashedPassword
    };
    userData.users.push(newUser);
    await writeUserData(userData);
    return res.status(201).json({ message: '登録成功' });
  } catch (error) {
    console.error('登録エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// 🔹 ユーザーログイン API（JSON版）の変更
app.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const usersData = await readUserData()
    console.log('Received email:', email)
    console.log('UserData:', usersData)
    
    const user = usersData.users.find(u => u.email.trim() === email.trim())
    if (!user) return res.status(400).json({ error: 'ユーザーが見つかりません' })
    
    // bcryptでパスワードを検証
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'パスワードが間違っています' })
    }
    
    console.log('パスワード検証成功、トークン生成開始')
    console.log('JWT_SECRET:', JWT_SECRET) // デバッグ用
    
    // JWTトークンを生成（直接JWT_SECRET変数を使用）
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    )
    
    console.log('トークン生成成功:', token.substring(0, 20) + '...')
    
    // ユーザー情報を返す
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email
    }
    
    res.json({ token, user: userData })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'ログインエラー: ' + err.message })
  }
})

// 追加: ユーザー情報取得API
app.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const userData = await readUserData()
    const user = userData.users.find(u => u.id === parseInt(req.params.id))
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' })
    
    // パスワードを除外してユーザー情報を返す
    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email
    }
    res.json(safeUser)
  } catch (err) {
    console.error('User fetch error:', err)
    res.status(500).json({ error: 'サーバーエラー' })
  }
})

// 🔹 投稿 API（JSON版）- ユーザー名を追加保存するよう修正
app.post('/posts', authenticateToken, async (req, res) => {
  console.log('投稿処理開始:', req.user.id)
  
  const { image_url, message, isVideo } = req.body
  console.log('投稿内容:', { 
    image_url: image_url ? image_url.substring(0, 20) + '...' : '未設定', 
    message: message ? message.substring(0, 20) + '...' : '未設定',
    isVideo: isVideo || false
  })
  
  try {
    const data = await readData()
    const userData = await readUserData()
    
    // ユーザー情報を取得
    const user = userData.users.find(u => u.id === req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' })
    }
    
    const user_id = req.user.id
    const id = data.posts.length > 0 ? data.posts[data.posts.length - 1].id + 1 : 1
    
    // 画像パスを相対パスに変換
    let relativeImageUrl = image_url.startsWith('D:/uploads')
      ? image_url.replace('D:/uploads', '/uploads')
      : image_url
    
    // 絶対URLに変換（バックエンド経由で画像配信）
    if(relativeImageUrl.startsWith('/uploads')) {
      relativeImageUrl = req.protocol + '://' + req.get('host') + relativeImageUrl
    }
    
    // 投稿データにユーザー名とメディアタイプを追加
    const newPost = { 
      id, 
      user_id, 
      username: user.username, // ユーザー名を明示的に保存
      image_url: relativeImageUrl, 
      message,
      isVideo: isVideo || false, // 動画かどうかのフラグ
      created_at: new Date().toISOString(), 
      likeCount: 0,
      bookmarkCount: 0
    }
    
    data.posts.push(newPost)
    await writeData(data)
    res.json(newPost)
  } catch (err) {
    console.error("投稿処理エラー:", err)
    res.status(500).json({ error: '投稿エラー: ' + err.message })
  }
})

// 修正: 投稿一覧取得処理でユーザー情報も付与
app.get('/posts', async (req, res) => {
  try {
    const data = await readData();
    const userData = await readUserData();
    
    const fixedPosts = await Promise.all(data.posts.map(async post => {
      // 画像パス修正
      if (post.image_url.startsWith('D:/uploads')) {
        post.image_url = post.image_url.replace('D:/uploads', '/uploads');
      }
      if(post.image_url.startsWith('/uploads')) {
        post.image_url = req.protocol + '://' + req.get('host') + post.image_url;
      }
      
      // 投稿者情報の追加
      const user = userData.users.find(u => u.id === post.user_id);
      if (user) {
        post.username = user.username;
        // アイコンパスなどがあれば追加
      }
      
      // いいね・ブックマーク数のカウント
      post.likeCount = data.likes.filter(like => like.post_id === post.id).length;
      post.bookmarkCount = data.bookmarks.filter(bookmark => bookmark.post_id === post.id).length;
      
      return post;
    }));
    
    res.json(fixedPosts);
  } catch (err) {
    console.error('投稿取得エラー:', err);
    res.status(500).json({ error: '投稿取得エラー' });
  }
});

// いいね・ブックマークチェックAPIのURLを修正
// `/likes/check/:post_id` の代わりに `/check-like/:post_id` を使用
app.get('/check-like/:post_id', authenticateToken, async (req, res) => {
  try {
    const data = await readData();
    const user_id = req.user.id;
    const post_id = parseInt(req.params.post_id);
    
    // このユーザーがこの投稿にいいねしているか確認
    const liked = data.likes.some(like => 
      like.user_id === user_id && like.post_id === post_id
    );
    
    res.json({ liked });
  } catch (err) {
    console.error('いいねチェックエラー:', err);
    res.status(500).json({ error: 'いいねチェックに失敗しました' });
  }
});

// `/bookmarks/check/:post_id` の代わりに `/check-bookmark/:post_id` を使用
app.get('/check-bookmark/:post_id', authenticateToken, async (req, res) => {
  try {
    const data = await readData();
    const user_id = req.user.id;
    const post_id = parseInt(req.params.post_id);
    
    // このユーザーがこの投稿をブックマークしているか確認
    const bookmarked = data.bookmarks.some(bookmark => 
      bookmark.user_id === user_id && bookmark.post_id === post_id
    );
    
    res.json({ bookmarked });
  } catch (err) {
    console.error('ブックマークチェックエラー:', err);
    res.status(500).json({ error: 'ブックマークチェックに失敗しました' });
  }
});

// 🔹 いいね API（JSON版）
app.post('/likes', authenticateToken, async (req, res) => {
  const { post_id } = req.body
  try {
    const data = await readData()
    const user_id = req.user.id
    if (data.likes.some(like => like.user_id === user_id && like.post_id === post_id)) {
      return res.status(400).json({ error: '既にいいね済み' })
    }
    const id = data.likes.length > 0 ? data.likes[data.likes.length - 1].id + 1 : 1
    const newLike = { id, user_id, post_id }
    data.likes.push(newLike)
    await writeData(data)
    res.json(newLike)
  } catch (err) {
    res.status(500).json({ error: 'いいねエラー' })
  }
})
app.delete('/likes', authenticateToken, async (req, res) => {
  const { post_id } = req.body
  try {
    const data = await readData()
    const user_id = req.user.id
    const index = data.likes.findIndex(like => like.user_id === user_id && like.post_id === post_id)
    if (index === -1) return res.status(400).json({ error: 'いいねが見つかりません' })
    data.likes.splice(index, 1)
    await writeData(data)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: '削除エラー' })
  }
})

// 🔹 ブックマーク API（JSON版）
app.post('/bookmarks', authenticateToken, async (req, res) => {
  const { post_id } = req.body
  try {
    const data = await readData()
    const user_id = req.user.id
    if (data.bookmarks.some(bm => bm.user_id === user_id && bm.post_id === post_id)) {
      return res.status(400).json({ error: '既にブックマーク済み' })
    }
    const id = data.bookmarks.length > 0 ? data.bookmarks[data.bookmarks.length - 1].id + 1 : 1
    const newBookmark = { id, user_id, post_id }
    data.bookmarks.push(newBookmark)
    await writeData(data)
    res.json(newBookmark)
  } catch (err) {
    res.status (500).json({ error: 'ブックマークエラー' })
  }
})
app.delete('/bookmarks', authenticateToken, async (req, res) => {
  const { post_id } = req.body
  try {
    const data = await readData()
    const user_id = req.user.id
    const index = data.bookmarks.findIndex(bm => bm.user_id === user_id && bm.post_id === post_id)
    if (index === -1) return res.status(400).json({ error: 'ブックマークが見つかりません' })
    data.bookmarks.splice(index, 1)
    await writeData(data)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: '削除エラー' })
  }
})

app.listen(3000, () => console.log('Server running on port 3000'));
