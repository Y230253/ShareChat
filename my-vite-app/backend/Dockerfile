FROM node:18

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm install

# サービスアカウントキーをコピー
COPY gcp-key.json .

# フロントエンドファイルのコピー（パスを修正）
COPY dist/ /app/dist/

# アプリケーションのソースをコピー
COPY *.js ./

# サーバー起動
CMD [ "node", "server.js" ]
