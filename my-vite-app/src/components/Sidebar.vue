<script setup>
import { defineProps } from 'vue'
const props = defineProps({
  isOpen: Boolean
})
</script>
<template>
  <div class="sidebar" :class="{'sidebar-open': isOpen}">
    <h2>📷 Photo Chat</h2>
    <nav>
      <ul>
        <li><router-link to="/">ホーム</router-link></li>
        <li><router-link to="/favorite">お気に入り</router-link></li>
        <li><router-link to="/posts">投稿</router-link></li>
        <li><router-link to="/tags">タグ</router-link></li>
      </ul>
    </nav>
  </div>
</template>
<style scoped>
  .sidebar {
    position: fixed;
    top: 60px;
    left: 0;
    width: 200px;
    height: 100vh;
    background-color: #42b983;
    color: white;
    padding: 30px;
    transform: translateX(-100%);
    transition: transform 0.3s;
  }
  
  .sidebar-open {
    transform: translateX(0);
  }
  .sidebar h2 {
    text-align: center;
  }
  
  .sidebar ul {
    list-style: none;
    padding: 0;
  }
  
  .sidebar li {
    margin: 10px 0;
  }
  
  .sidebar a {
    color: white;
    text-decoration: none;
    display: block;
    padding: 8px;
    border-radius: 5px;
  }
  
  .sidebar a:hover {
    background-color: #36996f;
  }
</style>
