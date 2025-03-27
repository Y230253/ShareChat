<script setup>
import { useRouter, useRoute } from 'vue-router'
import { defineProps, ref, computed, onMounted, onUnmounted, watch } from 'vue';
import authStore from '../authStore.js';

const router = useRouter()
const route = useRoute()
const props = defineProps({
  toggleSidebar: Function
});

// ログイン状態を監視
const isLoggedIn = computed(() => authStore.isLoggedIn.value);
const user = computed(() => authStore.user.value);

// 初期化
onMounted(() => {
  authStore.initAuth();
});

const goToRegister = () => {
  console.log("Navigating to /register")
  router.push('/register').catch(err => console.error(err))
}

const goToLogin = () => {
  console.log("Navigating to /login")
  router.push('/login').catch(err => console.error(err))
}

const logout = () => {
  authStore.clearUser();
  router.push('/login');
}
</script>

<template>
  <header class="header">
    <button class="menu-btn" @click="toggleSidebar">☰</button>  
    
    <!-- 非ログイン時のみ表示 -->
    <div v-if="!isLoggedIn" class="auth-buttons">
      <button class="register" @click="goToRegister">
        <router-link to="/register">新規登録</router-link>
      </button>
      <button class="login" @click="goToLogin">
        <router-link to="/login">ログイン</router-link>
      </button>
    </div>
    
    <!-- ログイン時のみ表示 -->
    <div v-else class="user-info">
      <span class="welcome">ようこそ、{{ user?.username || user?.email }}さん</span>
      <button class="logout" @click="logout">ログアウト</button>
    </div>
    
    <h1>📷 ShareChat 💬</h1>
  </header>
</template>
  
<style scoped>
.header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 60px;
  background-color: #42b983;
  display: flex;
  justify-content: center;
  color: white;
  text-align: center;
  font-size: 10px;
}

.menu-btn {
  position: absolute;
  left: 10px;
  top: 0px;
  font-size: 30px;
  background-color: transparent;
  border: none;
  color: white;
  transform: skew(20deg);
  transition: 0.3s;
  outline: none;
  box-shadow: none;
}

.auth-buttons, .user-info {
  position: absolute;
  right: 10px;
  top: 5px;
  display: flex;
  align-items: center;
}

.register, .login, .logout {
  font-size: 20px;
  background-color: rgb(0, 0, 0);
  border: none;
  color: rgb(255, 255, 255);
  margin-left: 10px;
}

.welcome {
  font-size: 16px;
  margin-right: 15px;
  font-weight: bold;
}

/* 既存のスタイル */
.register:hover, .login:hover, .logout:hover {
  background-color: #55ccd4;
  cursor: pointer;
}

.menu-btn:before,
.menu-btn:after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 2px;
  background-color: transparent;
}

.menu-btn:before {
  -webkit-transform: translate(-50%, -50%) rotate(45deg);
  transform: translate(-50%, -50%) rotate(45deg);
}

.menu-btn:after {
  -webkit-transform: translate(-50%, -50%) rotate(-45deg);
  transform: translate(-50%, -50%) rotate(-45deg);
}

.menu-btn:hover {
  -webkit-transform: skew(0);
  transform: skew(0);
  font-size: 33px;
  color: #ffffff;
  background-color: transparent;
  cursor: pointer;
}
</style>
