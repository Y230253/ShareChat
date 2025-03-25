<template>
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
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const file = ref(null)
const message = ref('')
const errorMsg = ref('') // 新規エラーメッセージ状態

const handleFileChange = (e) => {
  file.value = e.target.files[0]
}

const handleSubmit = async () => {
  try {
    if (!file.value) {
      errorMsg.value = "ファイルが選択されていません"
      return
    }
    const formData = new FormData()
    formData.append('file', file.value)

    const uploadRes = await fetch('http://localhost:3000/upload', { method: 'POST', body: formData })
    if(!uploadRes.ok) {
      errorMsg.value = "アップロードに失敗しました"
      return
    }
    const uploadData = await uploadRes.json()
    const imageUrl = uploadData.imageUrl

    const postRes = await fetch('http://localhost:3000/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 1,
        image_url: imageUrl,
        message: message.value
      })
    })
    if(!postRes.ok) {
      errorMsg.value = "投稿に失敗しました"
      return
    }
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
