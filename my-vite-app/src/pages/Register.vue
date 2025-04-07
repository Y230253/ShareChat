<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import authStore from '../authStore.js';
import { api } from '../services/api.js';

const router = useRouter();

// フォームデータ
const username = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const avatar = ref(null);
const previewAvatar = ref('');

// UI状態
const loading = ref(false);
const error = ref('');
const successMessage = ref('');

// アバターのアップロード処理
const handleAvatarChange = (e) => {
  const file = e.target.files[0];
  
  if (!file) return;
  
  // ファイルサイズのバリデーション (5MB)
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'ファイルサイズは5MB以内である必要があります。';
    return;
  }
  
  // プレビュー表示
  const reader = new FileReader();
  reader.onload = (e) => {
    previewAvatar.value = e.target.result;
  };
  reader.readAsDataURL(file);
  
  // 選択したファイルを保存
  avatar.value = file;
};

// アバタープレビューの削除
const removeAvatar = () => {
  previewAvatar.value = '';
  avatar.value = null;
};

// フォーム送信処理
const handleSubmit = async () => {
  try {
    // バリデーション
    if (!username.value.trim()) {
      error.value = 'ユーザー名は必須です。';
      return;
    }
    
    // ユーザー名に特殊文字がないかチェック
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username.value)) {
      error.value = 'ユーザー名には英数字とアンダースコアのみ使用できます。';
      return;
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
      error.value = '有効なメールアドレスを入力してください。';
      return;
    }

    // パスワードの強度チェック (最低6文字)
    if (password.value.length < 6) {
      error.value = 'パスワードは6文字以上である必要があります。';
      return;
    }

    loading.value = true;

    // フォームデータの作成
    const formData = new FormData();
    formData.append('username', username.value);
    formData.append('email', email.value);
    formData.append('password', password.value);
    
    // アバターがある場合
    if (avatar.value) {
      formData.append('icon', avatar.value);
    }

    // APIリクエスト
    const response = await fetch('/register', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const data = await response.json();
      error.value = data.error || '登録に失敗しました。';
      loading.value = false;
      return;
    }

    // 登録成功
    success.value = '登録が完了しました！ログインページに移動します...';
    loading.value = false;

    // ログインページにリダイレクト
    setTimeout(() => {
      router.push('/login');
    }, 2000);
    
  } catch (err) {
    error.value = 'エラーが発生しました: ' + err.message;
    loading.value = false;
  }
};
</script>

<template>
  <div class="register-container">
    <h1>アカウント登録</h1>
    
    <form @submit.prevent="handleSubmit" class="register-form">
      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
      
      <!-- アバターのアップロード -->
      <div class="form-group avatar-upload">
        <label>プロフィール画像 (任意)</label>
        
        <div class="avatar-preview-container">
          <div class="avatar-preview" v-if="previewAvatar">
            <img :src="previewAvatar" alt="Avatar preview" />
            <button type="button" class="remove-avatar" @click="removeAvatar">×</button>
          </div>
          
          <div class="avatar-placeholder" v-else>
            <span>画像を選択</span>
          </div>
          
          <input 
            type="file" 
            id="avatar" 
            accept="image/*" 
            @change="handleAvatarChange"
            class="file-input"
          />
        </div>
      </div>
      
      <!-- ユーザー名 -->
      <div class="form-group">
        <label for="username">ユーザー名</label>
        <input 
          type="text" 
          id="username" 
          v-model="username" 
          placeholder="ユーザー名を入力"
          required
        />
      </div>
      
      <!-- メールアドレス -->
      <div class="form-group">
        <label for="email">メールアドレス</label>
        <input 
          type="email" 
          id="email" 
          v-model="email" 
          placeholder="メールアドレスを入力"
          required
        />
      </div>
      
      <!-- パスワード -->
      <div class="form-group">
        <label for="password">パスワード</label>
        <input 
          type="password" 
          id="password" 
          v-model="password" 
          placeholder="パスワードを入力"
          required
        />
      </div>
      
      <!-- パスワード確認 -->
      <div class="form-group">
        <label for="confirm-password">パスワード確認</label>
        <input 
          type="password" 
          id="confirm-password" 
          v-model="confirmPassword" 
          placeholder="パスワードを再入力"
          required
        />
      </div>
      
      <!-- 送信ボタン -->
      <button 
        type="submit" 
        class="register-button" 
        :disabled="loading"
      >
        {{ loading ? '登録中...' : '登録する' }}
      </button>
      
      <div class="login-link">
        すでにアカウントをお持ちですか？ <router-link to="/login">ログイン</router-link>
      </div>
    </form>
  </div>
</template>

<style scoped>
.register-container {
  max-width: 500px;
  margin: 60px auto;
  padding: 20px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 30px;
}

.avatar-upload {
  margin-bottom: 20px;
}

.avatar-preview-container {
  display: flex;
  justify-content: center;
  margin-top: 10px;
  position: relative;
}

.avatar-preview, .avatar-placeholder {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  background-color: #e8f5e9;
  border: 2px dashed #a5d6a7;
  color: #2e7d32;
}

.avatar-placeholder:hover {
  background-color: #c8e6c9;
}

.remove-avatar {
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.file-input {
  position: absolute;
  width: 100px;
  height: 100px;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  cursor: pointer;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.register-button {
  width: 100%;
  padding: 12px;
  background-color: #2e7d32;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 10px;
  transition: background-color 0.3s;
}

.register-button:hover:not(:disabled) {
  background-color: #1b5e20;
}

.register-button:disabled {
  background-color: #a5d6a7;
  cursor: not-allowed;
}

.login-link {
  text-align: center;
  margin-top: 20px;
}

.login-link a {
  color: #2e7d32;
  text-decoration: none;
  font-weight: bold;
}

.login-link a:hover {
  text-decoration: underline;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.success-message {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}
</style>
