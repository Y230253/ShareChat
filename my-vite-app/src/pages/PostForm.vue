<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="post-form">
        <h1>新規投稿</h1>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="mediaType">メディアタイプ</label>
            <select id="mediaType" v-model="mediaType">
              <option value="image">画像</option>
              <option value="video">動画</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="file">{{ mediaType === 'image' ? '写真' : '動画' }}を選択</label>
            <input 
              type="file" 
              id="file" 
              @change="handleFileChange" 
              :accept="mediaType === 'image' ? 'image/*' : 'video/*'"
              required
            >
            
            <!-- プレビュー表示 -->
            <div v-if="filePreviewUrl" class="preview-container">
              <img v-if="mediaType === 'image'" :src="filePreviewUrl" alt="プレビュー" class="preview-media">
              <video v-else :src="filePreviewUrl" controls class="preview-media"></video>
              <button type="button" @click="clearFileSelection" class="clear-btn">選択解除</button>
            </div>
          </div>
          
          <div class="form-group">
            <label for="message">コメント</label>
            <textarea id="message" v-model="message" rows="4"></textarea>
          </div>
          
          <!-- タグ選択エリア -->
          <div class="form-group">
            <label>タグ選択</label>
            <div class="tag-selection-area">
              <!-- 選択済みタグ -->
              <div class="selected-tags">
                <span v-for="tag in selectedTags" :key="tag" class="tag">
                  {{ tag }}
                  <button type="button" @click="removeTag(tag)" class="remove-tag">×</button>
                </span>
              </div>
              
              <!-- タグ入力フォーム -->
              <div class="tag-input-area">
                <input
                  type="text"
                  v-model="tagInput"
                  @keydown.enter.prevent="addTag"
                  @keydown.tab.prevent="addTag"
                  placeholder="新しいタグ（Enterで追加）"
                  class="tag-input"
                />
                <button type="button" @click="addTag" class="add-tag-btn">追加</button>
              </div>
              
              <!-- 人気タグ表示 -->
              <div class="popular-tags">
                <p>人気のタグ:</p>
                <div class="tag-cloud">
                  <button
                    type="button"
                    v-for="tag in popularTags"
                    :key="tag.id"
                    @click="selectExistingTag(tag.name)"
                    class="tag-btn"
                    :class="{ selected: selectedTags.includes(tag.name) }"
                  >
                    {{ tag.name }} ({{ tag.count || 0 }})
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="errorMsg" class="error">
            {{ errorMsg }}
          </div>
          
          <div class="buttons">
            <button type="submit" class="submit-btn">投稿する</button>
            <button type="button" @click="handleCancel" class="cancel-btn">キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import authStore from '../authStore.js'
import Header from '../components/header.vue'
import Sidebar from '../components/Sidebar.vue'
import { apiCall } from '../services/api.js' // APIサービスをインポート

const router = useRouter()
const file = ref(null)
const message = ref('')
const errorMsg = ref('')
const isSidebarOpen = ref(false)
const mediaType = ref('image') // デフォルトは画像
const filePreviewUrl = ref('') // プレビュー表示用URL

// タグ関連
const tagInput = ref('')
const selectedTags = ref([])
const popularTags = ref([])

// ログインチェック
onMounted(() => {
  if (!authStore.isLoggedIn.value) {
    errorMsg.value = "投稿するには、ログインが必要です"
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }
  
  // 人気のタグを取得
  fetchPopularTags()
})

// 人気のタグを取得する関数
const fetchPopularTags = async () => {
  try {
    // 404エラーを適切に処理
    try {
      const tags = await apiCall('/tags');
      popularTags.value = tags.slice(0, 10); // 上位10件のみ表示
    } catch (apiError) {
      console.error('タグ取得エラー:', apiError);
      
      // APIが失敗した場合はデフォルトのタグを使用
      popularTags.value = [
        { id: 1, name: '風景', count: 10 },
        { id: 2, name: '料理', count: 8 },
        { id: 3, name: '旅行', count: 7 },
        { id: 4, name: '動物', count: 6 },
        { id: 5, name: '自然', count: 5 }
      ];
    }
  } catch (err) {
    console.error('タグ処理エラー:', err);
  }
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const handleFileChange = (e) => {
  const selectedFile = e.target.files[0]
  
  if (!selectedFile) {
    clearFileSelection()
    return
  }
  
  file.value = selectedFile
  
  // ファイルタイプをチェック
  const fileType = selectedFile.type
  if (mediaType.value === 'image' && !fileType.startsWith('image/')) {
    errorMsg.value = "画像ファイルを選択してください"
    clearFileSelection()
    return
  }
  
  if (mediaType.value === 'video' && !fileType.startsWith('video/')) {
    errorMsg.value = "動画ファイルを選択してください"
    clearFileSelection()
    return
  }
  
  // プレビューURLを作成
  filePreviewUrl.value = URL.createObjectURL(selectedFile)
  errorMsg.value = ''
}

const clearFileSelection = () => {
  file.value = null
  if (filePreviewUrl.value) {
    URL.revokeObjectURL(filePreviewUrl.value)
    filePreviewUrl.value = ''
  }
}

// タグを追加する関数
const addTag = () => {
  const tag = tagInput.value.trim()
  if (tag && !selectedTags.value.includes(tag) && selectedTags.value.length < 5) {
    selectedTags.value.push(tag)
    tagInput.value = ''
  } else if (selectedTags.value.length >= 5) {
    errorMsg.value = "タグは最大5つまで設定できます"
    setTimeout(() => errorMsg.value = '', 3000)
  }
}

// タグを削除する関数
const removeTag = (tag) => {
  selectedTags.value = selectedTags.value.filter(t => t !== tag)
}

// 既存のタグを選択/解除する関数
const selectExistingTag = (tagName) => {
  if (selectedTags.value.includes(tagName)) {
    removeTag(tagName)
  } else if (selectedTags.value.length < 5) {
    selectedTags.value.push(tagName)
  } else {
    errorMsg.value = "タグは最大5つまで設定できます"
    setTimeout(() => errorMsg.value = '', 3000)
  }
}

const handleSubmit = async () => {
  try {
    if (!authStore.isLoggedIn.value) {
      errorMsg.value = "ログインが必要です"
      setTimeout(() => router.push('/login'), 1500)
      return
    }

    if (!file.value) {
      errorMsg.value = "ファイルが選択されていません"
      return
    }

    // 認証トークン取得
    const token = localStorage.getItem('token')
    console.log('認証トークン存在チェック:', token ? '存在します' : '存在しません')
    
    if (!token) {
      errorMsg.value = "認証情報が見つかりません"
      setTimeout(() => router.push('/login'), 1500)
      return
    }

    // ファイルアップロード
    const formData = new FormData()
    formData.append('file', file.value)

    // APIサービスを使用せず、FormDataを直接送信する必要があるため特殊ケース
    const uploadRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/upload`, { 
      method: 'POST', 
      body: formData 
    })
    
    if(!uploadRes.ok) {
      const errorData = await uploadRes.json()
      errorMsg.value = errorData.error || "アップロードに失敗しました"
      return
    }
    
    const uploadData = await uploadRes.json()
    const imageUrl = uploadData.imageUrl
    const isVideo = mediaType.value === 'video' || uploadData.isVideo

    // 投稿処理（APIサービスを使用）
    const postData = await apiCall('/posts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: {
        image_url: imageUrl,
        message: message.value,
        isVideo: isVideo,
        tags: selectedTags.value
      }
    })
    
    // クリーンアップ
    clearFileSelection()
    
    console.log('投稿成功:', postData)
    
    router.push('/')
  } catch (err) {
    console.error("投稿処理エラー:", err)
    errorMsg.value = "ネットワークエラーが発生しました"
  }
}

const handleCancel = () => {
  clearFileSelection()
  router.push('/')
}
</script>

<style scoped>
.post-form {
  max-width: 600px;
  margin: 1rem auto;
  padding: 2rem;
  height: 700px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #c2e2b0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
.post-form h1 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #2e7d32;
}
.form-group {
  margin-bottom: 1.5rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #2e7d32;
}
.form-group select,
.form-group textarea,
.form-group input[type="text"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #a5d6a7;
  border-radius: 4px;
  font-size: 1rem;
}
.preview-container {
  margin-top: 1rem;
  position: relative;
  max-width: 100%;
  text-align: center;
}
.preview-media {
  max-width: 100%;
  max-height: 300px;
  border-radius: 4px;
}
.clear-btn {
  position: absolute;
  top: 0;
  right: 0;
  background-color: rgba(255, 255, 255, 0.8);
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
}
.submit-btn {
  background-color: #2e7d32;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  padding: 0.75rem 1.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}
.error {
  color: #e53935;
  margin-bottom: 1rem;
  text-align: center;
}

/* タグ関連のスタイル */
.tag-selection-area {
  margin-top: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
  background-color: #f9f9f9;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag {
  display: inline-flex;
  align-items: center;
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 0.25rem 0.5rem;
  border-radius: 16px;
  font-size: 0.875rem;
}

.remove-tag {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  margin-left: 4px;
  font-size: 1rem;
  line-height: 1;
  padding: 0 2px;
}

.tag-input-area {
  display: flex;
  margin-bottom: 1rem;
}

.tag-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px 0 0 4px;
}

.add-tag-btn {
  background-color: #2e7d32;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  padding: 0 1rem;
  cursor: pointer;
}

.popular-tags {
  margin-top: 1rem;
}

.popular-tags p {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-btn {
  background-color: #f1f8e9;
  border: 1px solid #c5e1a5;
  color: #558b2f;
  border-radius: 16px;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-btn:hover {
  background-color: #dcedc8;
}

.tag-btn.selected {
  background-color: #aed581;
  color: #33691e;
  border-color: #8bc34a;
}
</style>
