// モックデータ - バックエンドへのアクセスができない場合のフォールバック

export const mockPosts = [
  {
    id: 1,
    user_id: 1,
    username: "デモユーザー",
    user_icon: null,
    image_url: "https://storage.googleapis.com/sharechat-media-bucket/demo/sample1.jpg",
    message: "これはデモ投稿です。バックエンド接続エラーのため、モックデータを表示しています。",
    isVideo: false,
    created_at: new Date().toISOString(),
    likeCount: 5,
    bookmarkCount: 2,
    tags: ["デモ", "サンプル"]
  },
  {
    id: 2,
    user_id: 1,
    username: "デモユーザー",
    user_icon: null,
    image_url: "https://storage.googleapis.com/sharechat-media-bucket/demo/sample2.jpg",
    message: "API接続に問題があるようです。ネットワーク設定やCORS設定を確認してください。",
    isVideo: false,
    created_at: new Date().toISOString(),
    likeCount: 3,
    bookmarkCount: 1,
    tags: ["エラー", "接続問題"]
  }
];

export const mockTags = [
  { id: 1, name: "デモ", count: 5 },
  { id: 2, name: "サンプル", count: 3 },
  { id: 3, name: "エラー", count: 2 },
  { id: 4, name: "接続問題", count: 1 }
];
