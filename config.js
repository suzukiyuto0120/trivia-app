// ============================================================
// config.js  ―― Supabase への接続設定（本物の値を書くファイル）
// ============================================================
// 役割：
//   Supabase に接続するための「URL」と「公開キー(anon key)」を
//   ここに書いておき、app.js から読み込んで使います。
//
// 重要：
//   このファイルは .gitignore に登録してあるため Git には含まれません。
//   （見本は config.example.js を参照）
//
// 値の取得元：
//   Supabase 管理画面 → Project Settings → API
//     - url     : 「Project URL」
//     - anonKey : 「Project API keys」の anon public
// ------------------------------------------------------------

// app.js から読めるように、グローバルな箱(window)に入れておく。
window.SUPABASE_CONFIG = {
  // ↓↓↓ 自分の Supabase プロジェクトの値に書き換えてください ↓↓↓
  url: "https://urqrdsodxaioamzwnvnz.supabase.co",
  anonKey: "sb_publishable_UFp8esi2OiUz46KLveQmaQ_TUK2bLj5",
};
