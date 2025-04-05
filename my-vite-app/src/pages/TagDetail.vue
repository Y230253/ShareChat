<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../services/api.js';
import PostCard from '../components/PostCard.vue';

const route = useRoute();
const router = useRouter();
const tagName = ref('');
const posts = ref([]);
const loading = ref(true);
const error = ref(null);

// 投稿を読み込む関数
const loadPosts = async (tag) => {
  if (!tag) return;
  
  try {
    loading.value = true;
    error.value = null;
    tagName.value = tag;
    
    console.log(`タグ "${tag}" の投稿を読み込み中...`);
    // 修正したAPIを使用
    const result = await api.posts.getByTag(tag);
    
    if (Array.isArray(result)) {
      posts.value = result;
      console.log(`${posts.value.length}件の投稿を取得しました`);
    } else {
      console.warn('投稿データが配列ではありません:', result);
      posts.value = [];
    }
  } catch (err) {
    console.error(`タグ "${tag}" の投稿取得エラー:`, err);
    error.value = '投稿の読み込み中にエラーが発生しました。';
    posts.value = [];
  } finally {
    loading.value = false;
  }
};

// ルートパラメータが変更されたときに再読み込み
watch(() => route.params.name, (newTagName) => {
  if (newTagName) {
    loadPosts(newTagName);
  }
});

onMounted(() => {
  const tag = route.params.name;
  if (tag) {
    loadPosts(tag);
  }
});
</script>

<!-- ...existing template code... -->
