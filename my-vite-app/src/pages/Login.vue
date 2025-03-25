<template>
  <div>
    <!-- 登録フォームのコンテンツをここに記述 -->
    <h1>ユーザーログイン</h1>
    <form @submit.prevent="handleLogin">
      <div>
        <label for="email">メールアドレス</label>
        <input type="email" id="email" v-model="email" required>
      </div>
      <div>
        <label for="password">パスワード</label>
        <input type="password" id="password" v-model="password" required>
      </div>
      <button type="submit">ログイン</button>
    </form>
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const errorMsg = ref('')

const handleLogin = async () => {
  try {
    const res = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value })
    })
    if (!res.ok) {
      const errData = await res.json()
      errorMsg.value = errData.error || 'ログインエラー'
      return
    }
    const data = await res.json()
    // トークンを保存
    localStorage.setItem('token', data.token)
    router.push('/')
  } catch (err) {
    console.error('ログインエラー:', err)
    errorMsg.value = 'ネットワークエラー'
  }
}
</script>
