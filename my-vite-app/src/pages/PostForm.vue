<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div :class="['content', { 'with-sidebar': isSidebarOpen }]">
        <div class="post-form-container">
          <h1>写真・動画投稿フォーム</h1>
          
          <div v-if="errorMsg" class="error-message">{{ errorMsg }}</div>
          <div v-if="successMsg" class="success-message">{{ successMsg }}</div>
          
          <form @submit.prevent="submitForm" class="post-form">
            <!-- ファイルアップロードセクション -->
            <div class="form-section">
              <h2>メディアをアップロード</h2>
              
              <div 
                class="upload-area"
                :class="{'dragging': isDragging, 'has-preview': filePreview}"
                @dragover.prevent="handleDragOver"
                @dragleave.prevent="handleDragLeave"
                @drop.prevent="handleDrop"
              >
                <div v-if="!filePreview && !uploading" class="upload-placeholder">
                  <div class="icon">📷</div>
                  <p>クリックまたはドラッグ＆ドロップで写真や動画をアップロード</p>
                  <p class="hint">対応形式: JPG, PNG, GIF, MP4, MOVなど</p>
                </div>
                
                <div v-if="uploading" class="upload-loading">
                  <div class="spinner"></div>
                  <p>アップロード中 ({{ uploadProgress }}%)...</p>
                </div>
                
                <div v-else-if="filePreview" class="preview-container">
                  <!-- 画像プレビュー -->
                  <img 
                    v-if="!isVideo" 
                    :src="filePreview" 
                    class="image-preview" 
                    alt="Uploaded preview"
                  />
                  
                  <!-- 動画プレビュー -->
                  <video 
                    v-else 
                    :src="filePreview" 
                    class="video-preview" 
                    controls
                    autoplay
                    muted
                    loop
                  ></video>
                  
                  <button type="button" @click="removeFile" class="remove-btn">削除</button>
                </div>
                
                <input 
                  type="file"
                  ref="fileInput"
                  @change="handleFileSelected"
                  accept="image/*,video/*"
                  class="file-input"
                />
              </div>
              
              <div v-if="fileError" class="error-message">{{ fileError }}</div>
            </div>
            
            <!-- メッセージ入力セクション -->
            <div class="form-section">
              <h2>メッセージ</h2>
              <textarea 
                v-model="message" 
                placeholder="メッセージを入力してください（任意）"
                rows="4"
              ></textarea>
            </div>
            
            <!-- タグ入力セクション -->
            <div class="form-section">
              <h2>タグ (任意)</h2>
              
              <div class="tags-input-container">
                <div class="tag-chips">
                  <span v-for="tag in selectedTags" :key="tag" class="tag-chip">
                    {{ tag }}
                    <button type="button" @click="removeTag(tag)" class="remove-tag">&times;</button>
                  </span>
                </div>
                
                <div class="tag-input-row">
                  <input 
                    v-model="tagInput"
                    @keydown.enter.prevent="addTag"
                    placeholder="タグを入力して Enter"
                    class="tag-input"
                  />
                  <button type="button" @click="addTag" class="add-tag-btn">追加</button>
                </div>
              </div>
              
              <!-- 人気のタグを表示 -->
              <div class="popular-tags">
                <p class="popular-tags-title">人気のタグ:</p>
                <div class="tag-suggestions">
                  <button 
                    v-for="tag in popularTags" 
                    :key="tag.id"
                    type="button"
                    @click="selectPopularTag(tag.name)"
                    class="tag-suggestion"
                    :class="{ 'selected': selectedTags.includes(tag.name) }"
                  >
                    #{{ tag.name }} ({{ tag.count || 0 }})
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 送信ボタン -->
            <div class="form-actions">
              <button type="submit" :disabled="!isFormValid || isSubmitting" class="submit-btn">
                {{ isSubmitting ? '投稿中...' : '投稿する' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import Header from '../components/header.vue';
import Sidebar from '../components/Sidebar.vue';
import authStore from '../authStore.js';
import { apiCall, api, uploadFile } from '../services/api.js';
import { mockTags } from '../services/mock-data.js';

const router = useRouter();
const isSidebarOpen = ref(false);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

// フォームデータ
const fileInput = ref(null);
const filePreview = ref(null);
const message = ref('');
const tagInput = ref('');
const selectedTags = ref([]);
const popularTags = ref([]);

// UI状態
const isDragging = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const isSubmitting = ref(false);
const errorMsg = ref('');
const successMsg = ref('');
const fileError = ref('');
const isVideo = ref(false);

// アップロードしたファイルのURL
const uploadedFileUrl = ref('');

// ログインチェック
onMounted(() => {
  if (!authStore.isLoggedIn.value) {
    errorMsg.value = "投稿するには、ログインが必要です";
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  }
  
  // 人気のタグを取得
  fetchPopularTags();
});

// 人気のタグを取得する関数
const fetchPopularTags = async () => {
  try {
    // 404エラーを適切に処理
    try {
      const tags = await api.tags.getAll();
      popularTags.value = Array.isArray(tags) ? tags.slice(0, 10) : []; // 上位10件のみ表示
    } catch (apiError) {
      console.error('タグ取得エラー:', apiError);
      
      // APIが失敗した場合はモックデータを使用
      popularTags.value = mockTags.slice(0, 10);
    }
  } catch (error) {
    console.error('タグデータ取得エラー:', error);
    popularTags.value = [
      { id: 1, name: '風景', count: 10 },
      { id: 2, name: '料理', count: 8 },
      { id: 3, name: '旅行', count: 7 },
      { id: 4, name: '動物', count: 6 },
    ];
  }
};

// ドラッグ操作のハンドリング
const handleDragOver = (e) => {
  isDragging.value = true;
  e.dataTransfer.dropEffect = 'copy';
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleDrop = (e) => {
  isDragging.value = false;
  
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
};

// ファイル選択
const handleFileSelected = (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFile(e.target.files[0]);
  }
};

// ファイル処理
const handleFile = async (file) => {
  // ファイルタイプチェック
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  
  if (![...validImageTypes, ...validVideoTypes].includes(file.type)) {
    fileError.value = '非対応のファイル形式です。画像または動画ファイルをアップロードしてください。';
    return;
  }

  fileError.value = '';
  
  // ファイルサイズチェック (5GB上限)
  const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
  if (file.size > maxSize) {
    fileError.value = 'ファイルサイズが大きすぎます。5GB以下のファイルを選択してください。';
    return;
  }
  
  // 動画かどうかを判定
  isVideo.value = validVideoTypes.includes(file.type);
  
  // ファイルサイズを表示
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  console.log(`ファイルサイズ: ${fileSizeMB}MB (${file.size}バイト)`);

  // 大容量ファイル（100MB超）の場合は警告を表示
  const largeFileThreshold = 100 * 1024 * 1024; // 100MB
  if (file.size > largeFileThreshold) {
    console.log('大容量ファイルが選択されました。通常アップロードを使用します（チャンクアップロードはまだ準備中です）');
  }
  
  // ローカルプレビュー
  // 大きすぎるファイルはオブジェクトURLを使ってメモリ節約
  if (file.size > 50 * 1024 * 1024) { // 50MB以上
    filePreview.value = URL.createObjectURL(file);
  } else {
    // 小さいファイルは従来通りDataURLを使用
    const reader = new FileReader();
    reader.onload = (e) => {
      filePreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  try {
    // アップロード処理
    uploading.value = true;
    uploadProgress.value = 0;
    
    // アップロード進捗
    const onProgress = (progress) => {
      uploadProgress.value = Math.round(progress);
    };
    
    // 実際のアップロード - チャンクアップロードはバックエンド実装が必要なため、一時的に通常のアップロードを使用
    const result = await api.upload(file, onProgress);
    
    if (result && result.imageUrl) {
      uploadedFileUrl.value = result.imageUrl;
      isVideo.value = result.isVideo || false;
    } else {
      throw new Error('アップロードに失敗しました');
    }
  } catch (error) {
    console.error('アップロードエラー:', error);
    fileError.value = `アップロードエラー: ${error.message}`;
    // プレビューはそのままにする（エラー時も表示を維持）
  } finally {
    uploading.value = false;
    
    // オブジェクトURLを使った場合は参照を解放（実際のURLはそのまま）
    if (filePreview.value && typeof filePreview.value === 'string' && filePreview.value.startsWith('blob:')) {
      // 参照を変数に保存
      const blobUrl = filePreview.value;
      
      // URL.revokeObjectURLはアップロード完了後に呼び出す必要がある
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    }
  }
};

// ファイルの削除
const removeFile = () => {
  filePreview.value = null;
  uploadedFileUrl.value = '';
  isVideo.value = false;
  
  // input要素をリセット
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

// タグの追加
const addTag = () => {
  const tag = tagInput.value.trim();
  
  if (tag && !selectedTags.value.includes(tag)) {
    if (selectedTags.value.length >= 10) {
      fileError.value = 'タグは最大10個までです';
      return;
    }
    
    selectedTags.value.push(tag);
    tagInput.value = '';
  }
};

// タグの削除
const removeTag = (tag) => {
  selectedTags.value = selectedTags.value.filter(t => t !== tag);
};

// 人気のタグを選択
const selectPopularTag = (tagName) => {
  if (selectedTags.value.includes(tagName)) {
    // すでに選択されていたら削除
    selectedTags.value = selectedTags.value.filter(t => t !== tagName);
  } else {
    // 選択されていなければ追加
    if (selectedTags.value.length >= 10) {
      fileError.value = 'タグは最大10個までです';
      return;
    }
    
    selectedTags.value.push(tagName);
  }
};

// フォームのバリデーション
const isFormValid = computed(() => {
  return !!uploadedFileUrl.value || !!filePreview.value;
});

// フォーム送信
const submitForm = async () => {
  if (!isFormValid.value) {
    errorMsg.value = '画像または動画を選択してください';
    return;
  }
  
  if (isSubmitting.value) return;
  
  try {
    isSubmitting.value = true;
    errorMsg.value = '';
    
    // 認証チェック
    console.log('認証トークン存在チェック:', localStorage.getItem('token') ? '存在します' : '存在しません');
    
    if (!localStorage.getItem('token')) {
      errorMsg.value = '認証トークンがありません。再ログインしてください。';
      setTimeout(() => router.push('/login'), 2000);
      return;
    }
    
    // 投稿データの準備
    const postData = {
      image_url: uploadedFileUrl.value || filePreview.value,
      message: message.value,
      isVideo: isVideo.value,
      tags: selectedTags.value
    };
    
    // 投稿APIを呼び出し
    await api.posts.create(postData);
    
    // 成功表示
    successMsg.value = '投稿が完了しました！';
    
    // フォームをリセット
    message.value = '';
    removeFile();
    selectedTags.value = [];
    
    // ホームページへリダイレクト
    setTimeout(() => {
      router.push('/');
    }, 1500);
    
  } catch (error) {
    console.error('投稿エラー:', error);
    errorMsg.value = `投稿に失敗しました: ${error.message}`;
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.post-form-container {
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  margin-bottom: 20px;
  color: #2e7d32;
  font-size: 24px;
}

.form-section {
  margin-bottom: 25px;
}

h2 {
  font-size: 18px;
  margin-bottom: 10px;
  color: #333;
}

.upload-area {
  border: 2px dashed #a5d6a7;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  position: relative;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #2e7d32;
  background-color: rgba(46, 125, 50, 0.05);
}

.upload-area.dragging {
  border-color: #2e7d32;
  background-color: rgba(46, 125, 50, 0.1);
}

.upload-area.has-preview {
  border-style: solid;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-placeholder .icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.upload-placeholder p {
  margin: 5px 0;
}

.upload-placeholder .hint {
  font-size: 14px;
  color: #666;
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.preview-container {
  position: relative;
  width: 100%;
  max-height: 400px;
  overflow: hidden;
}

.image-preview, .video-preview {
  max-width: 100%;
  max-height: 400px;
  display: block;
  margin: 0 auto;
  border-radius: 4px;
}

.remove-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(46, 125, 50, 0.2);
  border-top-color: #2e7d32;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
  font-size: 16px;
}

.tags-input-container {
  margin-bottom: 10px;
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.tag-chip {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 5px 10px;
  border-radius: 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.remove-tag {
  background: none;
  border: none;
  color: #2e7d32;
  margin-left: 5px;
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-input-row {
  display: flex;
  gap: 10px;
}

.tag-input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-tag-btn {
  background-color: #2e7d32;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0 15px;
  cursor: pointer;
}

.popular-tags {
  margin-top: 15px;
}

.popular-tags-title {
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
}

.tag-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-suggestion {
  background-color: #f1f1f1;
  color: #333;
  padding: 5px 10px;
  border-radius: 16px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
}

.tag-suggestion.selected {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-color: #2e7d32;
}

.form-actions {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

.submit-btn {
  background-color: #2e7d32;
  color: white;
  padding: 12px 30px;
  font-size: 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  background-color: #1b5e20;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.submit-btn:disabled {
  background-color: #a5d6a7;
  cursor: not-allowed;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
}

.success-message {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
}
</style>
