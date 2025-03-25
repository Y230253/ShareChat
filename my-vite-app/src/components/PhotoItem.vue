<script setup>
import { defineProps, ref } from 'vue'
const props = defineProps({
  photo: Object // 投稿情報
})

// API のベース URL（必要に応じて環境変数などに置き換えてください）
const apiUrl = 'http://localhost:3000'

// いいね機能（エラーログ追加）
const liked = ref(false)
const likeCount = ref(props.photo.likeCount || 0)
const toggleLike = async () => {
  try {
    if(liked.value) {
      const response = await fetch(`${apiUrl}/likes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1, post_id: props.photo.id })
      })
      if(response.ok) {
        liked.value = false
        likeCount.value = Math.max(likeCount.value - 1, 0)
      } else {
        console.error("いいね解除エラー", await response.text())
      }
    } else {
      const response = await fetch(`${apiUrl}/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1, post_id: props.photo.id })
      })
      if(response.ok) {
        liked.value = true
        likeCount.value++
      } else {
        console.error("いいね追加エラー", await response.text())
      }
    }
  } catch (err) {
    console.error("いいね処理中エラー", err)
  }
}

// ブックマーク機能（エラーログ追加）
const isBookmarked = ref(false)
const bookmarkCount = ref(props.photo.bookmarkCount || 0)
const toggleBookmarkAction = async () => {
  try {
    if(isBookmarked.value) {
      const response = await fetch(`${apiUrl}/bookmarks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1, post_id: props.photo.id })
      })
      if(response.ok) {
        isBookmarked.value = false
        bookmarkCount.value = Math.max(bookmarkCount.value - 1, 0)
      } else {
        console.error("ブックマーク解除エラー", await response.text())
      }
    } else {
      const response = await fetch(`${apiUrl}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1, post_id: props.photo.id })
      })
      if(response.ok) {
        isBookmarked.value = true
        bookmarkCount.value++
      } else {
        console.error("ブックマーク追加エラー", await response.text())
      }
    }
  } catch (err) {
    console.error("ブックマーク処理中エラー", err)
  }
}
</script>

<template>
  <div class="photo-card">
    <div class="user-info">
      <img :src="photo.userIcon || 'https://via.placeholder.com/40'" class="user-icon" alt="User Icon">
      <div>
        <p class="username">{{ photo.username || ('ユーザー ' + photo.user_id) }}</p>
        <p class="date">{{ photo.date || photo.created_at }}</p>
      </div>
    </div>

    <img :src="photo.imageUrl || photo.image_url" class="photo" alt="Uploaded Photo">
    <p class="message">{{ photo.message }}</p>

    <!-- いいね・ブックマークボタン -->
    <div class="actions">
      <button @click="toggleLike">
        {{ liked ? 'いいね済' : 'いいね' }} ({{ likeCount }})
      </button>
      <button @click="toggleBookmarkAction">
        {{ isBookmarked ? 'ブックマーク済' : 'ブックマーク' }} ({{ bookmarkCount }})
      </button>
      <button class="comment-button">コメントする</button>
    </div>
  </div>
</template>

<style scoped>
.photo-card {
  width: 100%;
  max-width: 500px;
  background: white;
  padding: 15px;
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  margin-bottom: 20px;
}
.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.user-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
}
.username {
  font-weight: bold;
}
.date {
  color: gray;
  font-size: 12px;
}
.photo {
  width: 100%;
  border-radius: 10px;
}
.message {
  margin: 10px 0;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>