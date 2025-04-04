<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="login-container">
        <form @submit.prevent="login" class="login-form">
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
          <p v-if="error" class="error">{{ error }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import authStore from '../authStore';
import { api } from '../services/api'; // APIサービスをインポート

const email = ref('');
const password = ref('');
const error = ref('');
const router = useRouter();

const login = async (e) => {
  e.preventDefault();
  
  try {
    // 直接fetchの代わりにAPIサービスを使用
    const response = await api.auth.login({
      email: email.value,
      password: password.value
    });
    
    // ログイン成功したらトークンを保存
    authStore.setUser(response.user);
    authStore.setToken(response.token);
    
    console.log('ログイン成功！');
    router.push('/');
  } catch (err) {
    console.error('ログインエラー:', err);
    error.value = 'メールアドレスまたはパスワードが間違っています';
  }
};
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
