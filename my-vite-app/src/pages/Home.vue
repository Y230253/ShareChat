<template>
  <div>
    <PhotoList v-if="showPhotoList" />
    <button @click="goToPostForm"><router-link to="/posts">写真を投稿する</router-link></button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PhotoList from '../components/PhotoList.vue'
import { api } from '../services/api'

const router = useRouter()
const route = useRoute()
const showPhotoList = computed(() => route.meta.showPhotoList ?? true)

// 投稿フォームへ遷移
const goToPostForm = () => {
  console.log("Navigating to /posts")
  router.push('/posts').catch(err => console.error(err))
}

const posts = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    loading.value = true
    // localhostを直接参照する代わりに、APIサービスを使用
    posts.value = await api.posts.getAll()
  } catch (err) {
    console.error('投稿取得エラー', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
