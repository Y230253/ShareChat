<template>
  <div class="user-edit-container">
    <form @submit.prevent="handleUpdate" class="edit-form" enctype="multipart/form-data">
      <h1>プロフィール編集</h1>
      
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
      
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <div class="form-group">
        <label for="icon">プロフィール画像</label>
        <div class="icon-container">
          <div class="current-icon">
            <img v-if="iconPreview" :src="iconPreview" alt="現在のアイコン" />
            <div v-else class="icon-placeholder">{{ userInitials }}</div>
          </div>
          <div class="icon-controls">
            <label for="icon-upload" class="upload-btn">
              画像を変更
              <input
                id="icon-upload"
                type="file"
                @change="handleIconChange"
                accept="image/*"
                class="hidden-input"
              />
            </label>
            <button 
              v-if="iconFile || iconPreview" 
              type="button" 
              class="remove-btn"
              @click="removeIcon"
            >
              削除
            </button>
          </div>
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
        <label for="email">メールアドレス (変更不可)</label>
        <input
          id="email"
          type="email"
          v-model="email"
          disabled
          class="disabled-input"
        />
      </div>
      
      <div class="button-group">
        <button type="submit" class="submit-btn" :disabled="isSubmitting">
          {{ isSubmitting ? '更新中...' : '更新する' }}
        </button>
        <button type="button" class="cancel-btn" @click="goBack">キャンセル</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../services/api';
import authStore from '../authStore.js';

const router = useRouter();
const username = ref('');
const email = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const isSubmitting = ref(false);
const originalUsername = ref('');

// アイコン画像関連
const iconFile = ref(null);
const iconPreview = ref('');
const originalIcon = ref('');

// ユーザーのイニシャルを計算（アイコンがない場合のプレースホルダー）
const userInitials = computed(() => {
  const name = username.value || '';
  if (!name) return '?';
  
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
});

// プロフィールの読み込み
onMounted(async () => {
  if (!authStore.isLoggedIn.value) {
    errorMessage.value = 'ログインが必要です';
    setTimeout(() => {
      router.push('/login');
    }, 2000);
    return;
  }
  
  try {
    const user = authStore.user.value;
    if (user) {
      username.value = user.username || '';
      originalUsername.value = username.value;
      email.value = user.email || '';
      
      // アイコン画像の設定
      if (user.avatar || user.icon) {
        iconPreview.value = user.avatar || user.icon;
        originalIcon.value = iconPreview.value;
      }
    } else {
      // ユーザー情報が取得できない場合はAPIから取得を試みる
      const userData = await api.auth.getUser();
      if (userData) {
        username.value = userData.username || '';
        originalUsername.value = username.value;
        email.value = userData.email || '';
        
        if (userData.avatar || userData.icon) {
          iconPreview.value = userData.avatar || userData.icon;
          originalIcon.value = iconPreview.value;
        }
      }
    }
  } catch (error) {
    console.error('プロフィール情報の取得に失敗しました:', error);
    errorMessage.value = 'プロフィール情報の取得に失敗しました';
  }
});

const handleIconChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // ファイルサイズのチェック（5MB上限）
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'ファイルサイズは5MB以下である必要があります';
    return;
  }
  
  // 画像タイプの検証
  if (!file.type.startsWith('image/')) {
    errorMessage.value = '画像ファイルのみアップロードできます';
    return;
  }
  
  iconFile.value = file;
  iconPreview.value = URL.createObjectURL(file);
};

const removeIcon = () => {
  iconFile.value = null;
  iconPreview.value = '';
};

const handleUpdate = async () => {
  try {
    isSubmitting.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    
    // 変更があるかどうかチェック
    const usernameChanged = username.value !== originalUsername.value;
    const iconChanged = iconFile.value !== null || (iconPreview.value !== originalIcon.value);
    
    if (!usernameChanged && !iconChanged) {
      errorMessage.value = '変更点がありません';
      isSubmitting.value = false;
      return;
    }
    
    // アイコンアップロード
    let avatarUrl = iconPreview.value;
    
    if (iconFile.value) {
      try {
        const uploadResult = await api.upload(iconFile.value);
        if (uploadResult && uploadResult.imageUrl) {
          avatarUrl = uploadResult.imageUrl;
        }
      } catch (uploadError) {
        console.error('アイコン画像のアップロードに失敗:', uploadError);
        errorMessage.value = 'アイコン画像のアップロードに失敗しました';
        isSubmitting.value = false;
        return;
      }
    }
    
    // プロフィール更新APIを呼び出し
    const profileData = {
      username: username.value,
      avatar: avatarUrl
    };
    
    await api.auth.updateProfile(profileData);
    
    // 更新成功後、authStoreとローカルストレージのユーザー情報を更新
    const updatedUser = {
      ...authStore.user.value,
      username: username.value,
      avatar: avatarUrl
    };
    
    authStore.setUser(updatedUser);
    
    successMessage.value = 'プロフィールが正常に更新されました';
    
    // 3秒後にプロフィールページに戻る
    setTimeout(() => {
      router.push('/profile');
    }, 3000);
    
  } catch (error) {
    console.error('プロフィール更新エラー:', error);
    errorMessage.value = 'プロフィールの更新に失敗しました';
  } finally {
    isSubmitting.value = false;
  }
};

const goBack = () => {
  router.push('/profile');
};
</script>

<style scoped>
.user-edit-container {
  max-width: 600px;
  margin: 80px auto 40px;
  padding: 20px;
}

.edit-form {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

h1 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
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

.disabled-input {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.icon-container {
  display: flex;
  align-items: center;
  gap: 20px;
}

.current-icon {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #a5d6a7;
  display: flex;
  align-items: center;
  justify-content: center;
}

.current-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e8f5e9;
  color: #2e7d32;
  font-size: 2rem;
  font-weight: bold;
}

.icon-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upload-btn {
  display: inline-block;
  background-color: #2e7d32;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
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

.button-group {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 1.5rem;
}

.submit-btn, .cancel-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  min-width: 120px;
}

.submit-btn {
  background-color: #2e7d32;
  color: white;
  border: none;
}

.submit-btn:disabled {
  background-color: #a5d6a7;
  cursor: not-allowed;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.success-message {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}
</style>
