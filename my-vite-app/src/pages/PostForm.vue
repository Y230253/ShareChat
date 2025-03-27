<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="post-form">
        <h1>新規投稿</h1>
        <form @submit.prevent="handleSubmit">
          <div>
            <label for="photo">写真を選択</label>
            <input type="file" id="photo" @change="handleFileChange" required>
          </div>
          <div>
            <label for="message">コメント</label>
            <textarea id="message" v-model="message"></textarea>
          </div>
          <div>
            <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
          </div>
          <div class="buttons">
            <button type="submit">投稿する</button>
            <button type="button" @click="handleCancel">キャンセル</button>
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
  file.value = e.target.files[0]
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

    // JWT形式確認（デバッグ用）
    const tokenParts = token.split('.')
    if (tokenParts.length !== 3) {
      console.error('トークンフォーマットが不正:', token.substring(0, 10) + '...')
      errorMsg.value = "認証トークンの形式が不正です"
      return
    }
    
    console.log('トークン確認 (先頭部分):', token.substring(0, 20) + '...')

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

    // 投稿処理（認証ヘッダー付き）
    console.log('投稿リクエスト送信準備:', {
      image_url: imageUrl,
      message: message.value ? message.value.substring(0, 20) + '...' : '(空)',
      Authorization: `Bearer ${token.substring(0, 10)}...`
    })
    
    const postRes = await fetch('http://localhost:3000/posts', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image_url: imageUrl,
        message: message.value
      })
    })
    
    if(!postRes.ok) {
      console.error('投稿エラー:', postRes.status, postRes.statusText)
      const errorData = await postRes.json().catch(e => ({ error: '応答解析エラー' }))
      console.error('エラー詳細:', errorData)
      errorMsg.value = errorData.error || `投稿に失敗しました (${postRes.status})`
      
      // 認証エラーの場合は再ログインを促す
      if (postRes.status === 401 || postRes.status === 403) {
        errorMsg.value = "認証に失敗しました。再ログインしてください。"
        setTimeout(() => {
          authStore.clearUser() // 認証情報をクリア
          router.push('/login')
        }, 2000)
      }
      return
    }
    
    const postData = await postRes.json()
    console.log('投稿成功:', postData)
    
    router.push('/')
  } catch (err) {
    console.error("投稿処理エラー:", err)
    errorMsg.value = "ネットワークエラーが発生しました"
  }
}

const handleCancel = () => {
  router.push('/')
}
</script>

<style scoped>
.post-form {
  max-width: 600px;
  margin: 2rem auto;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}
.post-form h1 {
  text-align: center;
}
.post-form form > div {
  margin-bottom: 1rem;
}
.buttons {
  display: flex;
  justify-content: space-between;
}
.error {
  color: red;
  margin-bottom: 1rem;
}
</style>
