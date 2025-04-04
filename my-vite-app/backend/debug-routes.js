// Express.jsのルートをデバッグするためのユーティリティスクリプト

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// サーバーインスタンスの分析
async function analyzeRoutes() {
  try {
    // server.jsファイルの内容を読み込み
    const serverFilePath = path.join(__dirname, 'server.js');
    const serverContent = await fs.readFile(serverFilePath, 'utf8');
    
    // すべてのルート定義を抽出（簡易的な方法）
    const routeRegex = /app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    const routes = [];
    
    while ((match = routeRegex.exec(serverContent)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2]
      });
    }
    
    console.log('=== 定義されたルート ===');
    routes.sort((a, b) => a.path.localeCompare(b.path));
    
    // ルートをグループ化して表示
    const groupedRoutes = {};
    routes.forEach(route => {
      const prefix = route.path.split('/')[1] || 'root';
      if (!groupedRoutes[prefix]) {
        groupedRoutes[prefix] = [];
      }
      groupedRoutes[prefix].push(route);
    });
    
    for (const [group, groupRoutes] of Object.entries(groupedRoutes)) {
      console.log(`\n[${group}]`);
      groupRoutes.forEach(route => {
        console.log(`${route.method.padEnd(6)} ${route.path}`);
      });
    }
    
    console.log('\n=== サマリー ===');
    console.log(`総ルート数: ${routes.length}`);
    console.log(`認証関連ルート数: ${routes.filter(r => r.path.startsWith('/auth/')).length}`);
    console.log(`API関連ルート数: ${routes.filter(r => r.path.startsWith('/api/')).length}`);
    
    // MHTTPアクセステスト用のcurlコマンド生成
    console.log('\n=== テストコマンド ===');
    console.log('# ヘルスチェック');
    console.log('curl -v https://sharechat-backend-1047875971594.asia-northeast1.run.app/health');
    console.log('\n# ログインテスト (テストユーザーがある場合)');
    console.log('curl -v -X POST -H "Content-Type: application/json" -d \'{"email":"test@example.com","password":"password123"}\' https://sharechat-backend-1047875971594.asia-northeast1.run.app/auth/login');
    
  } catch (error) {
    console.error('Error analyzing routes:', error);
  }
}

analyzeRoutes();
