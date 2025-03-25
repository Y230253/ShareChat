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
const upload = multer({ storage: storage });

// 画像アップロードAPIのエラーハンドリングを追加
app.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({ error: 'アップロードに失敗しました' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
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

// 追加: 認証ミドルウェア
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'トークンがありません' })
  const token = authHeader.split(' ')[1]
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '無効なトークン' })
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

// 🔹 ユーザーログイン API（JSON版）
app.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const usersData = await readUserData()
    const user = usersData.users.find(u => u.email === email)
    if (!user) return res.status(400).json({ error: 'ユーザーが見つかりません' })
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) return res.status(401).json({ error: 'パスワードが間違っています' })
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' })
    res.json({ token })
  } catch (err) {
    res.status(500).json({ error: 'ログインエラー' })
  }
})

// 🔹 投稿 API（JSON版）
app.post('/posts', authenticateToken, async (req, res) => {
  const { image_url, message } = req.body
  try {
    const data = await readData()
    const user_id = req.user.id  // ログインしたユーザーID
    const id = data.posts.length > 0 ? data.posts[data.posts.length - 1].id + 1 : 1
    // 画像パスを相対パスに変換
    let relativeImageUrl = image_url.startsWith('D:/uploads')
      ? image_url.replace('D:/uploads', '/uploads')
      : image_url
    // 絶対URLに変換（バックエンド経由で画像配信）
    if(relativeImageUrl.startsWith('/uploads')) {
      relativeImageUrl = req.protocol + '://' + req.get('host') + relativeImageUrl
    }
    const newPost = { 
      id, 
      user_id, 
      image_url: relativeImageUrl, 
      message, 
      created_at: new Date().toISOString(), 
      likeCount: 0,
      bookmarkCount: 0
    }
    data.posts.push(newPost)
    await writeData(data)
    res.json(newPost)
  } catch (err) {
    console.error("投稿処理エラー:", err)
    res.status(500).json({ error: '投稿エラー' })
  }
})

// 追加: 投稿一覧取得処理で画像パスを変換
app.get('/posts', async (req, res) => {
  try {
    const data = await readData();
    const fixedPosts = data.posts.map(post => {
      if (post.image_url.startsWith('D:/uploads')) {
        post.image_url = post.image_url.replace('D:/uploads', '/uploads');
      }
      if(post.image_url.startsWith('/uploads')) {
        post.image_url = req.protocol + '://' + req.get('host') + post.image_url;
      }
      return post;
    });
    res.json(fixedPosts);
  } catch (err) {
    res.status(500).json({ error: '投稿取得エラー' });
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
