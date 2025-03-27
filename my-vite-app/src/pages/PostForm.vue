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

const router = useRouter()
const file = ref(null)
const message = ref('')
const errorMsg = ref('')
const isSidebarOpen = ref(false)
const mediaType = ref('image') // デフォルトは画像
const filePreviewUrl = ref('') // プレビュー表示用URL

// ログインチェック
onMounted(() => {
  if (!authStore.isLoggedIn.value) {
    errorMsg.value = "投稿するには、ログインが必要です"
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }
})

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

    const uploadRes = await fetch('http://localhost:3000/upload', { 
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

    // 投稿処理（認証ヘッダー付き）
    const postRes = await fetch('http://localhost:3000/posts', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image_url: imageUrl,
        message: message.value,
        isVideo: isVideo // 動画フラグを追加
      })
    })
    
    if(!postRes.ok) {
      const errorData = await postRes.json().catch(e => ({ error: '応答解析エラー' }))
      errorMsg.value = errorData.error || `投稿に失敗しました (${postRes.status})`
      
      if (postRes.status === 401 || postRes.status === 403) {
        errorMsg.value = "認証に失敗しました。再ログインしてください。"
        setTimeout(() => {
          authStore.clearUser()
          router.push('/login')
        }, 2000)
      }
      return
    }
    
    // クリーンアップ
    clearFileSelection()
    
    const postData = await postRes.json()
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
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #fff;
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
.form-group textarea {
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
</style>
