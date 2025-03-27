<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="login-container">
        <form @submit.prevent="handleLogin" class="login-form">
          <h1>ユーザーログイン</h1>
          <div class="form-group">
            <label for="email">メールアドレス</label>
            <input type="email" id="email" v-model="email" required>
          </div>
          <div class="form-group">
            <label for="password">パスワード</label>
            <input type="password" id="password" v-model="password" required>
          </div>
          <button type="submit" class="submit-btn">ログイン</button>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import authStore from '../authStore.js'
import Header from '../components/header.vue'
import Sidebar from '../components/Sidebar.vue'

const router = useRouter()
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const isSidebarOpen = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

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
    
    // ユーザー情報を取得（サーバーからのレスポンスにユーザー情報が含まれている場合）
    if (data.user) {
      // サーバーからユーザー情報が直接返された場合
      authStore.setUser(data.user)
    } else {
      // トークンから情報を抽出（簡易的な実装）
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]))
        // ユーザーIDとメールアドレスを取得
        const user = {
          id: payload.id,
          email: payload.email
        }
        // ユーザー名を取得するAPI呼び出し
        const userRes = await fetch(`http://localhost:3000/users/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${data.token}`
          }
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          user.username = userData.username
        }
        // 認証ストアにユーザー情報を保存
        authStore.setUser(user)
      } catch (err) {
        console.error('トークン解析エラー:', err)
      }
    }
    
    router.push('/')
  } catch (err) {
    console.error('ログインエラー:', err)
    errorMsg.value = 'ネットワークエラー'
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #e8f5e9;
  padding: 20px;
}

.login-form {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  max-width: 400px;
  width: 100%;
}

.login-form h1 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #2e7d32;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #a5d6a7;
  border-radius: 4px;
  font-size: 1rem;
}

.submit-btn {
  background-color: #2e7d32;
  color: white;
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 1.1rem;
  cursor: pointer;
}

.error {
  color: #d32f2f;
  text-align: center;
  margin-top: 1rem;
}
</style>
