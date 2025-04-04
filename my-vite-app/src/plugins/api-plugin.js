import { api } from '../services/api';

// Vueプラグイン - グローバルAPIアクセス
export default {
  install: (app, options) => {
    // グローバルプロパティとしてAPIを追加
    app.config.globalProperties.$api = api;
    
    // インジェクションキーとしても利用可能に
    app.provide('api', api);
    
    // コンソールにデバッグ情報を出力
    console.log('API Plugin initialized with base URL:', 
      import.meta.env.VITE_API_BASE_URL || 'https://api.sharechat-app.com');
  }
}
