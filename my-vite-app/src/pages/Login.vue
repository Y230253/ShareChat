<template>
    <div>
      <!-- 登録フォームのコンテンツをここに記述 -->
      <h1>ユーザーログイン</h1>
        <form>
            <div>
            <label for="email">メールアドレス</label>
            <input type="email" id="email" name="email" required>
            </div>
            <div>
            <label for="password">パスワード</label>
            <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">ログイン</button>
        </form>
    </div>
  </template>
  
  <script>
  export default {
    name: 'Login'
  }
  </script>
  