// API経路を別ファイルに分離して管理しやすく

import express from 'express';

const router = express.Router();

// ベーシックなヘルスチェックエンドポイント
router.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    message: 'ShareChat API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ルートが見つからない場合の404ハンドラー
router.use('*', (req, res) => {
  console.log(`404: ${req.originalUrl} not found`);
  res.status(404).json({ 
    error: 'Not Found',
    message: `The requested URL ${req.originalUrl} was not found on this server.`
  });
});

export default router;
