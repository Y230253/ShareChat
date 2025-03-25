<script setup>
import {defineProps} from 'vue';
const props = defineProps({
  toggleSidebar: Function
});
</script>
<template>
    <header class="header">
      <button class="menu-btn" @click="toggleSidebar">☰</button>  
      <button class="register" @click="register">新規登録</button>
      <button class="login" @click="login">ログイン</button>
      <h1>📷 ShareChat 💬</h1>
    </header>
  </template>
  
  <style scoped>
  .header {
    position: fixed; /*画面上部*/
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
    position: absolute; /*ボタンの位置*/
    left: 10px;
    top: 0px;
    font-size: 30px;
    background-color: transparent;
    border: none;
    color: white;
    transform: skew(20deg);
    transition: 0.3s;
    outline:none;
    box-shadow: none;
  }
  .register {
    position: absolute; /*ボタンの位置*/
    right: 130px;
    top: 5px;
    font-size: 20px;
    background-color: rgb(0, 0, 0);
    border: none;
    color: rgb(255, 255, 255);
  }
  .login {
    position: absolute; /*ボタンの位置*/
    right: 10px;
    top: 5px;
    font-size: 20px;
    background-color: rgb(0, 0, 0);
    border: none;
    color: rgb(253, 253, 253);
  }
  .register:hover {
  background-color: #55ccd4; /* 好きな色に変更 */
  cursor: pointer;           /* カーソルをポインターに変更 */
}
.login:hover {
  background-color: #55ccd4 ; /* 好きな色に変更 */
  cursor: pointer;           /* カーソルをポインターに変更 */
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
  font-size : 33px;
  color: #ffffff;
  background-color: transparent;
  cursor: pointer;           /* カーソルをポインターに変更 */
}
  </style>
  