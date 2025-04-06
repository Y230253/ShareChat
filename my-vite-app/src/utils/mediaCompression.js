/**
 * メディアファイル圧縮ユーティリティ
 * 
 * 画像と動画をクライアント側で圧縮するための関数を提供します。
 * CORS問題とファイルサイズ超過の対策として強化されたバージョン。
 */

/**
 * 画像を圧縮する関数
 * @param {File} imageFile - 圧縮する画像ファイル
 * @param {Object} options - 圧縮オプション
 * @returns {Promise<File>} - 圧縮後の画像ファイル
 */
export async function compressImage(imageFile, options = {}) {
  const { maxWidth = 1280, maxHeight = 720, quality = 0.7, maxSizeMB = 5 } = options;
  
  return new Promise((resolve, reject) => {
    // 画像だけを処理
    if (!imageFile.type.startsWith('image/')) {
      console.log('画像ファイルではないため圧縮をスキップします:', imageFile.type);
      resolve(imageFile);
      return;
    }
    
    // サーバーの制限未満の場合は圧縮不要
    if (imageFile.size <= maxSizeMB * 1024 * 1024) {
      console.log(`ファイルサイズが制限内なので圧縮は不要です (${(imageFile.size / (1024 * 1024)).toFixed(2)}MB <= ${maxSizeMB}MB)`);
      resolve(imageFile);
      return;
    }

    // ファイルリーダーの作成
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    
    reader.onload = (event) => {
      // 画像要素を作成
      const img = new Image();
      
      img.onload = () => {
        // 元のサイズを取得
        let width = img.width;
        let height = img.height;
        
        // 最大幅・高さを超える場合はサイズを縮小
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > maxWidth) {
            width = maxWidth;
            height = Math.round(width / aspectRatio);
          }
          
          if (height > maxHeight) {
            height = maxHeight;
            width = Math.round(height * aspectRatio);
          }
        }
        
        // キャンバスに描画して圧縮
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = width;
        canvas.height = height;
        
        // 縮小品質を向上させるためのスムージングを有効化
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Blob形式で取得
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('画像の圧縮に失敗しました'));
            return;
          }
          
          // 新しいFileオブジェクトを作成
          const compressedFile = new File([blob], imageFile.name, {
            type: blob.type || imageFile.type,
            lastModified: new Date().getTime()
          });
          
          console.log(`画像圧縮: ${imageFile.size} -> ${compressedFile.size} (${Math.round(compressedFile.size / imageFile.size * 100)}%)`);
          
          // それでもサイズが大きすぎる場合は、さらに圧縮を試みる
          if (compressedFile.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
            console.log('まだファイルサイズが大きいため、さらに圧縮を試みます');
            // 再帰的に圧縮（品質を下げて）
            compressImage(imageFile, {
              ...options, 
              quality: quality - 0.2,
              maxWidth: maxWidth * 0.8,
              maxHeight: maxHeight * 0.8
            }).then(resolve).catch(reject);
          } else {
            resolve(compressedFile);
          }
        }, imageFile.type, quality);
      };
      
      img.onerror = () => {
        reject(new Error('画像の読み込みに失敗しました'));
      };
      
      img.src = event.target.result;
    };
    
    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };
  });
}

/**
 * 圧縮が必要かどうかを判断する関数
 * @param {File} file - 判定するファイル
 * @param {number} threshold - 圧縮閾値（MB単位）
 * @returns {boolean} - 圧縮が必要ならtrue、不要ならfalse
 */
export function shouldCompress(file, threshold = 5) {
  const thresholdBytes = threshold * 1024 * 1024;
  return file.size > thresholdBytes;
}

/**
 * メディアファイルを最適化する関数
 * @param {File} file - 最適化するファイル
 * @param {Object} options - 圧縮オプション
 * @returns {Promise<File>} - 最適化されたファイル
 */
export async function optimizeMedia(file, options = {}) {
  // ファイルタイプによって処理を分ける
  if (file.type.startsWith('image/')) {
    // 画像の場合
    if (shouldCompress(file, options.threshold || 5)) {
      try {
        console.log('画像の圧縮を開始します');
        const compressedFile = await compressImage(file, options);
        
        // 圧縮結果のログ
        const originalSize = (file.size / (1024 * 1024)).toFixed(2);
        const compressedSize = (compressedFile.size / (1024 * 1024)).toFixed(2);
        const ratio = Math.round((compressedFile.size / file.size) * 100);
        
        console.log(`圧縮完了: ${originalSize}MB → ${compressedSize}MB (${ratio}%)`);
        
        return compressedFile;
      } catch (err) {
        console.warn('画像の圧縮に失敗したため、元のファイルを使用します:', err);
        return file;
      }
    }
  } else if (file.type.startsWith('video/')) {
    // 動画の場合は警告を表示
    if (file.size > 10 * 1024 * 1024) {
      console.warn('大容量動画ファイルです。サーバーの制限により処理できない可能性があります。');
    }
  }
  
  // 圧縮不要のファイルの場合は元のファイルをそのまま返す
  return file;
}

export default {
  compressImage,
  shouldCompress,
  optimizeMedia
};
