<template>
  <div class="edit-profile-container">
    <h1>プロフィールを編集</h1>
    
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>読み込み中...</p>
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <form v-else @submit.prevent="saveChanges" class="edit-form">
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
      
      <!-- アイコン編集セクション -->
      <div class="form-section">
        <h2>プロフィール画像</h2>
        <div class="avatar-editor">
          <div class="avatar-preview" :class="{ 'no-avatar': !avatarPreview }">
            <img v-if="avatarPreview" :src="avatarPreview" alt="プロフィール画像" />
            <div v-else class="avatar-placeholder">{{ userInitials }}</div>
          </div>
          
          <div class="avatar-controls">
            <label for="avatar-upload" class="upload-btn">
              画像を選択
              <input 
                type="file" 
                id="avatar-upload" 
                class="hidden-input" 
                accept="image/*"
                @change="handleAvatarChange" 
              />
            </label>
            
            <button 
              v-if="avatarPreview && (avatarPreview !== originalAvatar || avatarFile)" 
              type="button" 
              class="remove-btn"
              @click="removeAvatar"
            >
              削除
            </button>
          </div>
        </div>
      </div>
      
      <!-- ユーザーネーム編集セクション -->
      <div class="form-section">
        <h2>ユーザー情報</h2>
        <div class="form-group">
          <label for="username">ユーザーネーム</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            placeholder="ユーザーネームを入力"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <label for="email">メールアドレス (変更不可)</label>
          <input 
            type="email" 
            id="email" 
            v-model="email" 
            disabled 
            class="form-input disabled"
          />
        </div>
      </div>
      
      <!-- ボタンセクション -->
      <div class="form-actions">
        <button 
          type="submit" 
          class="save-btn" 
          :disabled="saving || !isChanged"
        >
          {{ saving ? '保存中...' : '保存する' }}
        </button>
        
        <button 
          type="button" 
          class="cancel-btn" 
          @click="cancelEdit" 
          :disabled="saving"
        >
          キャンセル
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import authStore from '../authStore.js';
import { api } from '../services/api.js';

const router = useRouter();
const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const successMessage = ref('');

// ユーザー情報
const username = ref('');
const email = ref('');
const originalUsername = ref('');
const avatarPreview = ref('');
const originalAvatar = ref('');
const avatarFile = ref(null);

// ユーザーのイニシャルを計算（アバターがない場合のプレースホルダー用）
const userInitials = computed(() => {
  const name = username.value || '';
  if (!name) return '?';
  
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
});

// 変更があるかどうかをチェック
const isChanged = computed(() => {
  const usernameChanged = username.value !== originalUsername.value;
  const avatarChanged = 
    (avatarFile.value !== null) || 
    (avatarPreview.value !== originalAvatar.value);
  
  return usernameChanged || avatarChanged;
});

// 初期データのロード
onMounted(async () => {
  console.log('EditProfile page mounted');
  
  if (!authStore.isLoggedIn.value) {
    console.error('Not logged in, redirecting to login page');
    error.value = 'ログインが必要です';
    setTimeout(() => {
      router.push('/login');
    }, 2000);
    return;
  }
  
  try {
    const user = authStore.user.value;
    
    // ユーザー情報がある場合はそこから取得
    if (user) {
      console.log('Using user info from authStore:', user);
      username.value = user.username || '';
      originalUsername.value = username.value;
      email.value = user.email || '';
      avatarPreview.value = user.avatar || user.icon || '';
      originalAvatar.value = avatarPreview.value;
    } else {
      console.log('No user info in authStore, fetching from API');
      // APIからユーザー情報を取得する場合
      const userData = await api.auth.getUser();
      if (userData) {
        console.log('User data fetched from API:', userData);
        username.value = userData.username || '';
        originalUsername.value = username.value;
        email.value = userData.email || '';
        avatarPreview.value = userData.avatar || userData.icon || '';
        originalAvatar.value = avatarPreview.value;
      }
    }
  } catch (err) {
    console.error('ユーザー情報取得エラー:', err);
    error.value = 'プロフィール情報の取得に失敗しました';
  } finally {
    loading.value = false;
  }
});

// アイコン画像の変更処理
const handleAvatarChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // ファイルサイズのチェック (5MB以内)
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'ファイルサイズは5MB以下にしてください';
    return;
  }
  
  // 画像ファイルのみ許可
  if (!file.type.startsWith('image/')) {
    error.value = '画像ファイルのみアップロードできます';
    return;
  }
  
  // プレビューを表示
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.value = e.target.result;
  };
  reader.readAsDataURL(file);
  
  // アップロード用にファイルを保存
  avatarFile.value = file;
  error.value = null;
};

// アイコンの削除
const removeAvatar = () => {
  avatarPreview.value = '';
  avatarFile.value = null;
  error.value = null;
};

// 変更を保存
const saveChanges = async () => {
  if (!isChanged.value) {
    console.log('No changes detected');
    return;
  }
  
  try {
    saving.value = true;
    error.value = null;
    successMessage.value = '';
    console.log('Saving profile changes...');
    
    // アイコン画像のアップロード（変更があれば）
    let avatarUrl = originalAvatar.value;
    if (avatarFile.value) {
      try {
        const uploadResult = await api.upload(avatarFile.value);
        if (uploadResult && uploadResult.imageUrl) {
          avatarUrl = uploadResult.imageUrl;
        } else {
          throw new Error('画像のアップロードに失敗しました');
        }
      } catch (uploadErr) {
        console.error('画像アップロードエラー:', uploadErr);
        throw new Error('プロフィール画像のアップロードに失敗しました');
      }
    } else if (avatarPreview.value === '') {
      // アバターを削除した場合
      avatarUrl = '';
    }
    
    // プロフィール情報を更新
    const profileData = {
      username: username.value,
      avatar: avatarUrl
    };
    
    // API呼び出しでプロフィールを更新
    await api.auth.updateProfile(profileData);
    
    // 成功した場合、authStoreのユーザー情報を更新
    const updatedUser = {
      ...authStore.user.value,
      username: username.value,
      avatar: avatarUrl
    };
    
    authStore.setUser(updatedUser);
    
    // オリジナルの値も更新
    originalUsername.value = username.value;
    originalAvatar.value = avatarUrl;
    avatarFile.value = null;
    
    console.log('Profile updated successfully');
    successMessage.value = 'プロフィールを更新しました';
    
    // 3秒後にメッセージをクリア
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);
    
  } catch (err) {
    console.error('プロフィール更新エラー:', err);
    error.value = err.message || 'プロフィールの更新に失敗しました';
  } finally {
    saving.value = false;
  }
};

// 編集のキャンセル
const cancelEdit = () => {
  username.value = originalUsername.value;
  avatarPreview.value = originalAvatar.value;
  avatarFile.value = null;
  error.value = null;
  successMessage.value = '';
  
  // ホーム画面に戻る
  router.push('/');
};
</script>

<style scoped>
.edit-profile-container {
  max-width: 600px;
  margin: 80px auto 40px;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 30px;
}

h2 {
  color: #2e7d32;
  margin-bottom: 15px;
  padding-bottom: 5px;
  border-bottom: 1px solid #e8f5e9;
}

.edit-form {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 25px;
}

.form-section {
  margin-bottom: 30px;
}

.avatar-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.avatar-preview {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #e8f5e9;
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
  width: 100%;
  height: 100%;
  background-color: #e8f5e9;
  color: #2e7d32;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: bold;
}

.avatar-controls {
  display: flex;
  gap: 10px;
}

.upload-btn {
  background-color: #2e7d32;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.hidden-input {
  display: none;
}

.remove-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.form-input:focus {
  outline: none;
  border-color: #2e7d32;
  box-shadow: 0 0 0 2px rgba(46, 125, 50, 0.2);
}

.form-input.disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.save-btn, .cancel-btn {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.save-btn {
  background-color: #2e7d32;
  color: white;
  border: none;
}

.save-btn:disabled {
  background-color: #a5d6a7;
  cursor: not-allowed;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.cancel-btn:disabled {
  color: #999;
  cursor: not-allowed;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 0;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #2e7d32;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.success-message {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}
</style>
