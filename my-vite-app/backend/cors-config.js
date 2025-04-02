// CORS設定を別ファイルに分離

import cors from 'cors';

// すべてのオリジンを許可するCORS設定
const corsOptions = {
  origin: '*',  // 本番環境では実際のフロントエンドドメインに制限することを推奨
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400  // 24時間
};

export const configureCors = (app) => {
  app.use(cors(corsOptions));
  
  // プリフライトリクエスト用のカスタム処理
  app.options('*', cors(corsOptions));
};
