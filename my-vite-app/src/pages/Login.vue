<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="login-container">
        <h1>{{ isRegisterMode ? '新規登録' : 'ログイン' }}</h1>
        
        <form @submit.prevent="handleSubmit">
          <!-- 登録モードのみ表示 -->
          <div v-if="isRegisterMode" class="form-group">
            <label for="username">ユーザー名</label>
            <input 
              type="text" 
              id="username" 
              v-model="formData.username"
              required
              placeholder="ユーザー名を入力"
            >
          </div>
          
          <div class="form-group">
            <label for="email">メールアドレス</label>
            <input 
              type="email" 
              id="email" 
              v-model="formData.email"
              required
              placeholder="メールアドレスを入力"
            >
          </div>
          
          <div class="form-group">
            <label for="password">パスワード</label>
            <div class="password-input">
              <input 
                :type="showPassword ? 'text' : 'password'" 
                id="password" 
                v-model="formData.password"
                required
                placeholder="パスワードを入力"
              >
              <button 
                type="button" 
                class="toggle-password"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? '👁️' : '👁️‍🗨️' }}
              </button>
            </div>
          </div>
          
          <!-- 登録モードのみ表示 -->
          <div v-if="isRegisterMode" class="form-group">
            <label for="password-confirm">パスワード（確認）</label>
            <div class="password-input">
              <input 
                :type="showPassword ? 'text' : 'password'" 
                id="password-confirm" 
                v-model="formData.passwordConfirm"
                required
                placeholder="パスワードを再入力"
              >
            </div>
          </div>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          
          <button type="submit" class="primary-button">
            {{ isRegisterMode ? '登録する' : 'ログインする' }}
          </button>
        </form>
        
        <div class="mode-switcher">
          <p>
            {{ isRegisterMode ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちでないですか？' }}
            <a href="#" @click.prevent="toggleMode">
              {{ isRegisterMode ? 'ログイン' : '新規登録' }}
            </a>
          </p>
        </div>
        
        <div class="debug-info" v-if="debugInfo">
          <h3>デバッグ情報</h3>
          <pre>{{ debugInfo }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import Header from '../components/header.vue';
import Sidebar from '../components/Sidebar.vue';
import authStore from '../authStore.js';
import { apiCall } from '../services/api.js';

const router = useRouter();
const isSidebarOpen = ref(false);
const isRegisterMode = ref(false);
const showPassword = ref(false);
const errorMessage = ref('');
const debugInfo = ref('');

const formData = reactive({
  username: '',
  email: '',
  password: '',
  passwordConfirm: ''
});

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const toggleMode = () => {
  isRegisterMode.value = !isRegisterMode.value;
  errorMessage.value = '';
};

const validateForm = () => {
  if (isRegisterMode.value) {
    if (!formData.username.trim()) {
      errorMessage.value = "ユーザー名を入力してください";
      return false;
    }
    
    if (formData.password !== formData.passwordConfirm) {
      errorMessage.value = "パスワードが一致しません";
      return false;
    }
    
    if (formData.password.length < 6) {
      errorMessage.value = "パスワードは6文字以上にしてください";
      return false;
    }
  }
  
  if (!formData.email.trim()) {
    errorMessage.value = "メールアドレスを入力してください";
    return false;
  }
  
  if (!formData.password.trim()) {
    errorMessage.value = "パスワードを入力してください";
    return false;
  }
  
  return true;
};

const handleSubmit = async () => {
  try {
    if (!validateForm()) return;
    
    errorMessage.value = '';
    debugInfo.value = '';
    
    if (isRegisterMode.value) {
      // 新規登録処理
      const response = await apiCall('/auth/register', {
        method: 'POST',
        body: {
          username: formData.username,
          email: formData.email,
          password: formData.password
        }
      });
      
      debugInfo.value = JSON.stringify(response, null, 2);
      
      // 登録成功したらログインモードに切り替え
      errorMessage.value = "登録が完了しました。ログインしてください。";
      isRegisterMode.value = false;
      
      // フォームをクリア
      formData.username = '';
      formData.password = '';
      formData.passwordConfirm = '';
    } else {
      // ログイン処理
      console.log('ログイン試行中...', formData.email);
      
      // APIを使ってログインリクエスト
      try {
        const response = await apiCall('/auth/login', {
          method: 'POST',
          body: {
            email: formData.email,
            password: formData.password
          }
        });
        
        console.log('ログイン応答:', response);
        debugInfo.value = JSON.stringify(response, null, 2);
        
        // 新しいauthStore.handleLoginResponse関数を使用
        if (authStore.handleLoginResponse(response)) {
          console.log('ログイン成功、リダイレクト準備中');
          // ログイン成功後にホームページへリダイレクト
          setTimeout(() => {
            router.push('/');
          }, 500);
        } else {
          errorMessage.value = "ログイン処理に失敗しました";
        }
      } catch (err) {
        console.error('ログインエラー:', err);
        errorMessage.value = err.message || "ログインに失敗しました";
      }
    }
  } catch (err) {
    console.error(isRegisterMode.value ? '登録エラー:' : 'ログインエラー:', err);
    errorMessage.value = err.message || (isRegisterMode.value ? "登録に失敗しました" : "ログインに失敗しました");
  }
};
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  background-color: white;
}

h1 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #2e7d32;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #444;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

input:focus {
  border-color: #2e7d32;
  outline: none;
}

.password-input {
  position: relative;
}

.toggle-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  color: #666;
}

.error-message {
  color: #e53935;
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.9rem;
}

.primary-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #2e7d32;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.primary-button:hover {
  background-color: #1b5e20;
}

.mode-switcher {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
}

.mode-switcher a {
  color: #2e7d32;
  text-decoration: none;
  font-weight: bold;
}

.mode-switcher a:hover {
  text-decoration: underline;
}

.debug-info {
  margin-top: 20px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
}

.debug-info pre {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
