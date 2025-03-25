import { ref } from 'vue';
export const bookmarkedPhotos = ref([]);
export function toggleBookmark(photo) {
  const index = bookmarkedPhotos.value.findIndex(p => p.id === photo.id);
  if(index !== -1) {
    bookmarkedPhotos.value.splice(index, 1);
  } else {
    bookmarkedPhotos.value.push(photo);
  }
}
