<script setup>
import {ref} from "vue";
const file = ref(null);
const imageUrl = ref("");
const uploadPhoto = async () => {
    if (!file.value) return;
    const formData = new FormData();
    formData.append("file", file.value);

    const res = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData
    });
    const data = await res.json();
    imageUrl.value = data.imageUrl;
};
const handleFileChange = (event) => {
    file.value = event.target.files[0];
};
</script>

<template>
    <div>
        <input type="file" @change="handleFileChange">
        <button @click="uploadPhoto">Upload</button>
        <div v-if="imageUrl" :src="imageUrl" alt="Uploaded Photo">
            <img :src="imageUrl" alt="Uploaded Photo">
        </div>
    </div>
</template>