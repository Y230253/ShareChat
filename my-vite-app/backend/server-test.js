import express from 'express';
import cors from 'cors';

// シンプルなテスト用サーバー
const app = express();
app.use(cors());

// ルートエンドポイント
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'ShareChat API is running!',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`テスト用サーバーが起動しました: http://localhost:${PORT}`);
});
