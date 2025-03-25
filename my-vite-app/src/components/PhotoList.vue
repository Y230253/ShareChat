<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import PhotoItem from "./PhotoItem.vue";

const props = defineProps({
  sidebarOpen: {
    type: Boolean,
    default: false
  }
});

const photos = ref([]); // 取得した投稿を格納

const columns = ref(props.sidebarOpen ? 3 : 4);

const updateColumns = () => {
  const width = window.innerWidth;
  if (width < 500) {
    columns.value = 1;
  } else if (width < 768) {
    columns.value = props.sidebarOpen ? 2 : 3;
  } else {
    columns.value = props.sidebarOpen ? 3 : 4;
  }
};

onMounted(() => {
  window.addEventListener('resize', updateColumns);
  updateColumns();

  // 追加: 投稿一覧をバックエンドから取得
  fetch('http://localhost:3000/posts')
    .then(res => res.json())
    .then(data => {
      photos.value = data;
    })
    .catch(err => console.error('投稿取得エラー', err));
});

onUnmounted(() => {
  window.removeEventListener('resize', updateColumns);
});

watch(() => props.sidebarOpen, () => {
  updateColumns();
});
</script>

<template>
  <div>
    <h1>Photo List📸</h1>
    <ul :style="{ display: 'grid', gap: '1rem', gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <li v-for="photo in photos" :key="photo.id">
        <photoItem :photo="photo" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
li {
  list-style: none;
}
img {
  width: 100%;
  height: auto;
}
</style>