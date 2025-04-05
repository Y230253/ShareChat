FROM node:18-slim

# アプリディレクトリを作成
WORKDIR /app

# Docker内の環境変数設定
ENV NODE_ENV=production
ENV PORT=8080

# 健全性チェックの設定
ENV HEALTH_CHECK_TIMEOUT=120s

# アプリケーションの依存関係をコピー
COPY package*.json ./

# 依存パッケージをインストール (自動エラー継続を無効化)
RUN npm install --production --no-optional && npm cache clean --force

# アプリケーションのソースをコピー
COPY . .

# アプリの起動に必要な一時ディレクトリを作成
RUN mkdir -p temp_uploads data

# コンテナがリスンするポートを指定
EXPOSE 8080

# アプリケーションの実行
CMD ["npm", "start"]
