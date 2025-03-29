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

// CORS設定を更新 - ワイルドカードではなく特定のオリジンを許可し、credentialsを有効にする
app.use(cors({
  origin: 'http://localhost:5173', // フロントエンドのURL
  credentials: true
}));

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
  fileFilter: fileFilter
  // ファイルサイズ制限を削除
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
      const defaultData = { users: [], posts: [], likes: [], bookmarks: [], comments: [], tags: [] };
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

// 🔹 ユーザー登録 API - エラーハンドリング強化
app.post('/register', upload.single('icon'), async (req, res) => {
  console.log('登録リクエスト受信:', {
    body: req.body,
    file: req.file ? `${req.file.filename} (${req.file.mimetype})` : 'なし'
  });
  
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    console.log('入力値エラー:', { username, email, password: password ? '***' : undefined });
    return res.status(400).json({ error: '全てのフィールドが必要です' });
  }

  try {
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
      iconUrl = `/uploads/${req.file.filename}`;
      // 絶対URLに変換
      iconUrl = req.protocol + '://' + req.get('host') + iconUrl;
    }
    
    const newUser = {
      id: userData.users.length ? userData.users[userData.users.length - 1].id + 1 : 1,
      username,
      email,
      password: hashedPassword,
      icon_url: iconUrl // アイコンURLを保存
    };
    
    userData.users.push(newUser);
    await writeUserData(userData);
    console.log('ユーザー登録成功:', { id: newUser.id, username, email });
    return res.status(201).json({ message: '登録成功' });
  } catch (error) {
    console.error('登録エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました: ' + error.message });
  }
});

// 🔹 ユーザーログイン API - アイコンURLも返すように修正
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
      email: user.email,
      icon_url: user.icon_url || null // アイコンURLも返す
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
  
  const { image_url, message, isVideo, tags } = req.body
  console.log('投稿内容:', { 
    image_url: image_url ? image_url.substring(0, 20) + '...' : '未設定', 
    message: message ? message.substring(0, 20) + '...' : '未設定',
    isVideo: isVideo || false,
    tags: tags || []
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
    }
    
    data.posts.push(newPost)

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
    const tagQuery = req.query.tag; // タグフィルタリング用クエリパラメータ
    
    let posts = data.posts;

    // タグでフィルタリング（指定があれば）
    if (tagQuery) {
      const normalizedTagQuery = tagQuery.toLowerCase();
      posts = posts.filter(post => 
        post.tags && 
        post.tags.some(tag => tag.toLowerCase() === normalizedTagQuery)
      );
    }
    
    const fixedPosts = await Promise.all(posts.map(async post => {
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
        post.user_icon = user.icon_url || null;
      }
      
      // いいね・ブックマーク数のカウント
      post.likeCount = data.likes.filter(like => like.post_id === post.id).length;
      post.bookmarkCount = data.bookmarks.filter(bookmark => bookmark.post_id === post.id).length;

      // タグが未設定の場合は空配列を設定
      if (!post.tags) {
        post.tags = [];
      }
      
      return post;
    }));
    
    res.json(fixedPosts);
  } catch (err) {
    console.error('投稿取得エラー:', err);
    res.status(500).json({ error: '投稿取得エラー' });
  }
});

// タグ一覧取得API（新規追加）
app.get('/tags', async (req, res) => {
  try {
    const data = await readData();

    // tags配列がなければ初期化
    if (!Array.isArray(data.tags)) {
      data.tags = [];
      await writeData(data);
    }

    // タグを使用頻度順にソート
    const sortedTags = [...data.tags].sort((a, b) => (b.count || 0) - (a.count || 0));
    
    res.json(sortedTags);
  } catch (err) {
    console.error('タグ取得エラー:', err);
    res.status(500).json({ error: 'タグの取得に失敗しました' });
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

// コメント関連のAPI
// コメント取得API
app.get('/comments/:post_id', async (req, res) => {
  console.log(`コメント取得リクエスト: post_id=${req.params.post_id}`);
  try {
    const data = await readData();
    const post_id = parseInt(req.params.post_id);
    
    // 指定された投稿IDに関するコメントを取得
    let comments = data.comments.filter(comment => comment.post_id === post_id);
    console.log(`該当コメント数: ${comments.length}`);
    
    // 各コメントにユーザー情報を付与
    const userData = await readUserData();
    comments = comments.map(comment => {
      const user = userData.users.find(u => u.id === comment.user_id);
      if (user) {
        return {
          ...comment,
          username: user.username,
          user_icon: user.icon_url || null
        };
      }
      return comment;
    });
    
    res.json(comments);
  } catch (err) {
    console.error('コメント取得エラー:', err);
    res.status(500).json({ error: 'コメント取得に失敗しました' });
  }
});

// コメント投稿API
app.post('/comments', authenticateToken, async (req, res) => {
  console.log('コメント投稿リクエスト受信:', req.body);
  const { post_id, text } = req.body;
  
  if (!post_id || !text || !text.trim()) {
    console.log('バリデーションエラー:', { post_id, text });
    return res.status(400).json({ error: '投稿IDとコメント内容が必要です' });
  }
  
  try {
    const data = await readData();
    const userData = await readUserData();
    
    // ユーザー情報を取得
    const user = userData.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    // コメントを作成
    const id = data.comments.length > 0 
      ? Math.max(...data.comments.map(c => c.id || 0)) + 1 
      : 1;
      
    const newComment = {
      id,
      post_id: parseInt(post_id),
      user_id: req.user.id,
      text: text.trim(),
      created_at: new Date().toISOString()
    };
    
    // データ構造を確認
    if (!Array.isArray(data.comments)) {
      console.log('comments配列が存在しないため初期化します');
      data.comments = [];
    }
    
    data.comments.push(newComment);
    await writeData(data);
    console.log('コメント保存成功:', newComment);
    
    // レスポンス用にユーザー情報を付与
    const commentWithUser = {
      ...newComment,
      username: user.username,
      user_icon: user.icon_url || null
    };
    
    res.status(201).json(commentWithUser);
  } catch (err) {
    console.error('コメント投稿エラー:', err);
    res.status(500).json({ error: 'コメント投稿に失敗しました: ' + err.message });
  }
});

// コメント削除API（オプション）
app.delete('/comments/:id', authenticateToken, async (req, res) => {
  const commentId = parseInt(req.params.id);
  
  try {
    const data = await readData();
    const commentIndex = data.comments.findIndex(c => c.id === commentId);
    
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'コメントが見つかりません' });
    }
    
    // 自分のコメントかチェック
    if (data.comments[commentIndex].user_id !== req.user.id) {
      return res.status(403).json({ error: '他のユーザーのコメントは削除できません' });
    }
    
    // コメント削除
    data.comments.splice(commentIndex, 1);
    await writeData(data);
    
    res.json({ success: true });
  } catch (err) {
    console.error('コメント削除エラー:', err);
    res.status(500).json({ error: 'コメント削除に失敗しました' });
  }
});

// ブックマークした投稿一覧取得API
app.get('/bookmarked-posts', authenticateToken, async (req, res) => {
  try {
    const data = await readData();
    const userData = await readUserData();
    const user_id = req.user.id;
    const tagQuery = req.query.tag; // タグフィルタリング用クエリパラメータ
    
    // このユーザーがブックマークした投稿IDの一覧を取得
    const bookmarkedPostIds = data.bookmarks
      .filter(bm => bm.user_id === user_id)
      .map(bm => bm.post_id);
    
    if (bookmarkedPostIds.length === 0) {
      // ブックマークがない場合は空配列を返す
      return res.json([]);
    }
    
    // ブックマークした投稿の詳細情報を取得
    let bookmarkedPosts = data.posts
      .filter(post => bookmarkedPostIds.includes(post.id));

    // タグでフィルタリング（指定があれば）
    if (tagQuery) {
      const normalizedTagQuery = tagQuery.toLowerCase();
      bookmarkedPosts = bookmarkedPosts.filter(post => 
        post.tags && 
        post.tags.some(tag => tag.toLowerCase() === normalizedTagQuery)
      );
    }

    bookmarkedPosts = bookmarkedPosts.map(post => {
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
        post.user_icon = user.icon_url || null;
      }
      
      // いいね・ブックマーク数のカウント
      post.likeCount = data.likes.filter(like => like.post_id === post.id).length;
      post.bookmarkCount = data.bookmarks.filter(bookmark => bookmark.post_id === post.id).length;

      // タグが未設定の場合は空配列を設定
      if (!post.tags) {
        post.tags = [];
      }
      
      return post;
    });
    
    // 新しい投稿順に並べ替え
    bookmarkedPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json(bookmarkedPosts);
  } catch (err) {
    console.error('ブックマーク投稿取得エラー:', err);
    res.status(500).json({ error: 'ブックマーク投稿の取得に失敗しました' });
  }
});

// サーバー起動時にデータ構造を確認
app.listen(3000, async () => {
  console.log('Server running on port 3000');
  
  // 起動時にデータファイルのコメント配列とタグ配列が存在するか確認
  try {
    const data = await readData();
    if (!data.comments) {
      console.log('コメント配列が存在しないため初期化します');
      data.comments = [];
    }
    if (!data.tags) {
      console.log('タグ配列が存在しないため初期化します');
      data.tags = [];
    }
    await writeData(data);
    console.log(`データ構造確認: ${Object.keys(data).join(', ')}`);
  } catch (err) {
    console.error('データ構造確認エラー:', err);
  }
});
