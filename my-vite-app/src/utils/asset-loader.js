/**
 * アセットローディングの問題を解決するためのユーティリティ
 */

// グローバルなアセットベースパスを管理
const assetBasePath = window.ASSET_BASE_PATH || '';

/**
 * アセットパスを適切に解決する
 * @param {string} path - アセットへの相対パス
 * @returns {string} - 完全なアセットパス
 */
export const resolveAssetPath = (path) => {
  // パスが既に絶対URLなら変更しない
  if (path && (path.startsWith('http://') || path.startsWith('https://'))) {
    return path;
  }
  
  // 相対パスの場合は、ベースパスを付加
  return `${assetBasePath}${path.startsWith('/') ? path.substring(1) : path}`;
};

/**
 * リソースがロード可能かを確認し、必要に応じて代替パスを試みる
 * @param {string} url - ロードするリソースURL
 * @param {string} fallbackUrl - 失敗時の代替URL
 * @returns {Promise<string>} - 利用可能なURL
 */
export const ensureResourceExists = async (url, fallbackUrl = null) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      return url;
    }
    
    // 最初のURLが失敗した場合、フォールバックを試す
    if (fallbackUrl) {
      const fallbackResponse = await fetch(fallbackUrl, { method: 'HEAD' });
      if (fallbackResponse.ok) {
        console.log(`リソース ${url} へのフォールバック: ${fallbackUrl}`);
        return fallbackUrl;
      }
    }
    
    console.warn(`リソース ${url} にアクセスできません`);
    return url; // それでも元のURLを返す
  } catch (error) {
    console.error(`リソース確認エラー: ${error}`);
    return fallbackUrl || url;
  }
};

// アプリケーション起動時に実行
export const initAssetSystem = () => {
  console.log(`アセットシステム初期化: ベースパス = ${assetBasePath}`);
  
  // SVGアイコンの存在確認
  ensureResourceExists('/vite.svg', `${assetBasePath}vite.svg`)
    .then(iconUrl => {
      // 動的にfaviconを設定
      const iconLink = document.querySelector('link[rel="icon"]');
      if (iconLink) {
        iconLink.href = iconUrl;
      }
    })
    .catch(console.error);
};
