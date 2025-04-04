<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="user-register-container">
        <form @submit.prevent="handleRegister" class="register-form" enctype="multipart/form-data">
          <h1>ユーザー登録</h1>
          
          <div class="form-group">
            <label for="icon">プロフィール画像</label>
            <input
              id="icon"
              type="file"
              @change="handleIconChange"
              accept="image/*"
            />
            <div v-if="iconPreview" class="icon-preview">
              <img :src="iconPreview" alt="アイコンプレビュー" />
            </div>
          </div>
          
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
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Header from '../components/header.vue';
import Sidebar from '../components/Sidebar.vue';
import { api } from '../services/api'; // APIサービスをインポート

const router = useRouter();
const username = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isSidebarOpen = ref(false);
const showPassword = ref(false);
const errorMessage = ref('');

// アイコン画像関連
const iconFile = ref(null);
const iconPreview = ref('');

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const togglePassword = () => {
  showPassword.value = !showPassword.value;
};

const handleIconChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    iconFile.value = file;
    iconPreview.value = URL.createObjectURL(file);
  }
};

const handleRegister = async () => {
  try {
    errorMessage.value = '';
    
    if (password.value !== confirmPassword.value) {
      errorMessage.value = 'パスワードが一致しません。';
      return;
    }
    
    // 半角英数字かつ8文字以上のバリデーション
    const passwordRegex = /^[A-Za-z0-9]{8,}$/;
    if (!passwordRegex.test(password.value)) {
      errorMessage.value = 'パスワードは半角英数字かつ8文字以上で入力してください。';
      return;
    }

    // FormDataを使用してマルチパートフォームデータを構築
    const formData = new FormData();
    formData.append('username', username.value);
    formData.append('email', email.value);
    formData.append('password', password.value);
    
    // アイコン画像があれば追加
    if (iconFile.value) {
      formData.append('icon', iconFile.value);
    }
    
    // 直接localhostを参照せず、環境変数のAPIエンドポイントを使用
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.sharechat-app.com';
    console.log('使用するAPIエンドポイント:', apiBaseUrl);
    
    const res = await fetch(`${apiBaseUrl}/register`, {
      method: 'POST',
      body: formData // Content-Typeはブラウザが自動設定
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      errorMessage.value = data.error || '登録に失敗しました';
      return;
    }
    
    alert('登録が完了しました');
    router.push('/login');
  } catch (err) {
    console.error('登録エラー:', err);
    errorMessage.value = 'ネットワークエラーが発生しました';
  }
};
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

/* アイコンプレビュー用スタイル */
.icon-preview {
  margin-top: 10px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  margin-left: auto;
  margin-right: auto;
  border: 2px solid #a5d6a7;
}

.icon-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.error-message {
  color: #d32f2f;
  margin-top: 1rem;
  text-align: center;
}
</style>
