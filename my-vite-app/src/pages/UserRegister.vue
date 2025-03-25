<template>
    <div>
      <!-- 登録フォームのコンテンツをここに記述 -->
      <h1>ユーザー登録</h1>
        <form>
            <div>
            <label for="name">ユーザーネーム</label>
            <input type="text" id="name" name="name" required>
            </div>
            <div>
            <label for="email">メールアドレス</label>
            <input type="email" id="email" name="email" required>
            </div>
            <div>
            <label for="password">パスワード</label>
            <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">登録</button>
        </form>
    </div>
  </template>
  
  <script>
  export default {
    name: 'UserRegister'
  }
  
  </script>
  