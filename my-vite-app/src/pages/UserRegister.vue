<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="user-register-container">
        <form @submit.prevent="handleRegister" class="register-form">
          <h1>ユーザー登録</h1>
          
          <div class="form-group">
            <label for="username">ユーザーネーム</label>
            <input
              id="username"
              type="text"
              v-model="username"
              placeholder="ユーザーネームを入力"
              autocomplete="username"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              v-model="email"
              placeholder="メールアドレスを入力"
              autocomplete="email"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="password">パスワード</label>
            <div class="password-field">
              <input
                id="password"
                :type="showPassword ? 'text' : 'password'"
                v-model="password"
                placeholder="半角英数字で8文字以上"
                autocomplete="new-password"
                required
              />
              <button type="button" class="toggle-password" @click="togglePassword">
                {{ showPassword ? '🙈' : '👁' }}
              </button>
            </div>
          </div>
          
          <div class="form-group">
            <label for="confirmPassword">パスワード（再確認）</label>
            <div class="password-field">
            <input
              id="confirmPassword"
              type="password"
              v-model="confirmPassword"
              placeholder="パスワードを再入力"
              autocomplete="new-password"
              required
            />
            <button type="button" class="toggle-password" @click="togglePassword">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
            </div>
          </div>
          
          <button type="submit" class="submit-btn">登録する</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Header from '../components/Header.vue'
import Sidebar from '../components/Sidebar.vue'

const router = useRouter()
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isSidebarOpen = ref(false)
const showPassword = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    alert('パスワードが一致しません。')
    return
  }
  // 半角英数字かつ8文字以上のバリデーション
  const passwordRegex = /^[A-Za-z0-9]{8,}$/
  if (!passwordRegex.test(password.value)) {
    alert('パスワードは半角英数字かつ8文字以上で入力してください。')
    return
  }
  try {
    const res = await fetch('http://localhost:3000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        email: email.value,
        password: password.value
      })
    })
    if (!res.ok) {
      const errorData = await res.json()
      alert(errorData.error || '登録に失敗しました')
      return
    }
    alert('登録が完了しました')
    router.push('/login')
  } catch (err) {
    console.error('登録エラー:', err)
    alert('ネットワークエラーが発生しました')
  }
}
</script>

<style scoped>
.user-register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #e8f5e9;
  padding: 20px;
}

.register-form {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  max-width: 400px;
  width: 100%;
}

.register-form h1 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  color: #2e7d32;
  font-weight: bold;
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid #a5d6a7;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #66bb6a;
}

.password-field {
  position: relative;
  display: flex;
  align-items: center;
}

.toggle-password {
  background: transparent;
  border: none;
  cursor: pointer;
  position: absolute;
  right: -10px;
  font-size: 1.2rem;
}

.submit-btn {
  background-color: #2e7d32;
  color: #fff;
  border: none;
  padding: 0.75rem;
  width: 100%;
  font-size: 1.1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.submit-btn:hover {
  background-color: #1b5e20;
}
</style>
