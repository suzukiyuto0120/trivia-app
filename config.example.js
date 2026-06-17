// ============================================================
// config.example.js  ―― 設定ファイルの「見本（テンプレート）」
// ============================================================
// 役割：
//   本物の設定ファイル config.js は .gitignore で Git 管理から
//   外しているため、リポジトリには残りません。
//   そこで「どんな形の設定が必要か」を示すための見本がこのファイルです。
//
// 使い方：
//   1. このファイルをコピーして config.js という名前で保存する
//        （ターミナルなら:  cp config.example.js config.js  ）
//   2. config.js の中の値を、自分の Supabase プロジェクトの値に書き換える
//   3. 値は Supabase の管理画面
//        Project Settings → API → 「Project URL」「Project API keys: anon public」
//      からコピーできます。
//
// 注意：このファイル(config.example.js)には本物のキーを書かないこと。
//       あくまで「形だけ」の見本です。
// ------------------------------------------------------------

// 他のファイル（app.js）から読めるように、グローバルな箱に入れておく。
window.SUPABASE_CONFIG = {
  // Supabase プロジェクトの URL（例: https://xxxxxxxx.supabase.co）
  url: "ここに Project URL を貼る",

  // 公開用の API キー（anon public key）。
  // ブラウザに出ても問題ない「公開キー」だが、
  // 書き込み制御は Supabase 側の権限設定(RLS)で行うのでここでは公開キーでOK。
  anonKey: "ここに anon public キーを貼る",
};
