// ============================================================
// app.js  ―― アプリの本体（今は「接続確認だけ」）
// ============================================================
// このファイルがやること（今の段階）：
//   1. config.js に書いた URL と公開キーを使って
//      Supabase クライアント（接続の窓口オブジェクト）を作る
//   2. うまく作れたら「Supabase に接続できました」と
//      画面とコンソールに表示する
//
// ※ まだ「知識の登録」「ログイン」などの機能は作りません。
//   あくまで "つながる準備ができたか" を確かめるだけです。
// ------------------------------------------------------------

// 画面に状態メッセージを出すための小さな関数。
// index.html の <p id="status"> にテキストを書き込みます。
function showStatus(message, isError) {
  const el = document.getElementById("status");
  el.textContent = message;
  // 成功は緑、失敗は赤で表示（見た目はあとで整える）
  el.style.color = isError ? "crimson" : "green";
}

// ここから実際の処理。
try {
  // (A) 設定が読み込めているか確認する。
  //     config.js を作り忘れていると SUPABASE_CONFIG は存在しない。
  const config = window.SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey) {
    throw new Error(
      "config.js が見つからない、または値が空です。config.example.js をコピーして config.js を作ってください。"
    );
  }

  // (B) Supabase クライアントを作る。
  //     index.html で読み込んだ supabase-js が、
  //     window.supabase という箱を用意してくれている。
  //     その中の createClient() を使って「接続の窓口」を作る。
  const supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
  );

  // 後で他の機能から使えるよう、作った窓口をグローバルに置いておく。
  window.db = supabaseClient;

  // (C) ここまでエラーなく来られたら「クライアントは作れた」。
  //     ＝ supabase-js の読み込みと設定の受け渡しは成功している。
  console.log("✅ Supabase に接続できました（クライアント作成に成功）", supabaseClient);
  showStatus("✅ Supabase に接続できました", false);

  // (D) 接続できたら、続けて各機能の準備を始める。
  //     （クライアント supabaseClient を渡して使ってもらう）
  setupAuth(supabaseClient);        // ログイン／ログアウト
  setupSearch(supabaseClient);      // 検索・絞り込みの操作
  setupNavigation(supabaseClient);  // 画面切り替え（ホーム／詳細／編集）のボタン

  // (E) ページを開いた時点で、一覧とタグ一覧を読み込む。
  //     一覧と検索は「未ログインの閲覧者でも使える」ので、
  //     ログイン状態に関係なく、ここで必ず読み込む。
  loadKnowledgeList(supabaseClient);
  loadTagList(supabaseClient);

  // (F) 起動時はホーム画面（一覧）を表示する。
  showView("home");
} catch (err) {
  // どこかで失敗したらここに来る。原因をコンソールと画面に出す。
  console.error("❌ Supabase への接続準備に失敗しました:", err);
  showStatus("❌ 接続に失敗しました: " + err.message, true);
}

// ============================================================
// ここから下：ログイン（認証）まわり
// ============================================================
// やること：
//   1. ログインフォームが送信されたら signInWithPassword でログイン
//   2. 成功/失敗のメッセージを画面に出す
//   3. ログアウトボタンでログアウトできる
//   4. 「いまログインしているか」に応じて画面の表示を切り替える
//
// ※ 新規ユーザー登録(signUp)は作りません。
//   自分のユーザーは Supabase 管理画面で作成済みのため。
// ------------------------------------------------------------

// いまログインしているユーザー（未ログインなら null）。
// 一覧に「編集／削除」ボタンを出すかどうかの判定に使う。
let currentUser = null;

// いま編集中の知識の id（新規登録モードなら null）。
// フォーム送信時に「新規 insert」か「既存 update」かの判定に使う。
let editingId = null;

// いまの検索条件。一覧を読み込むとき、この2つを条件として使う。
let currentKeyword = ""; // キーワード検索の文字（空なら条件なし）
let currentTag = null;   // 絞り込み中のタグ（null なら条件なし）

// いま詳細画面で表示している知識（無ければ null）。
// 詳細画面の「編集」「削除」ボタンから、どの知識かを参照するために使う。
let currentDetailItem = null;

function setupAuth(db) {
  // HTML の要素を取得しておく（毎回探さなくていいよう変数に入れる）。
  const loginForm = document.getElementById("login-form");   // ログインフォーム
  const accountBox = document.getElementById("account");     // ログイン済みエリア
  const loginInfo = document.getElementById("login-info");   // 「ログインしました(...)」表示先
  const logoutButton = document.getElementById("logout-button");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const newButton = document.getElementById("new-button"); // ＋新規登録ボタン

  // --- 「ログイン」トグルボタンを用意する -------------------
  // 普段はログインフォームを隠しておき、このボタンを押したときだけ開く方針。
  // index.html に #login-toggle があればそれを使い、無ければJSで作る。
  let loginToggle = document.getElementById("login-toggle");
  if (!loginToggle) {
    loginToggle = document.createElement("button");
    loginToggle.type = "button";
    loginToggle.id = "login-toggle";
    loginToggle.textContent = "ログイン";
    // ログインフォームのすぐ前に置く（ヘッダー内）。
    loginForm.parentNode.insertBefore(loginToggle, loginForm);
  }
  // トグルボタン：押すたびにログインフォームの表示／非表示を切り替える。
  loginToggle.addEventListener("click", function () {
    loginForm.hidden = !loginForm.hidden;
  });

  // --- 画面の表示を切り替える関数 ---------------------------
  // user が居れば「ログイン中の画面」、居なければ「フォーム画面」にする。
  function updateView(user) {
    // いまのログイン状態を覚えておく（一覧のボタン表示判定で使う）。
    currentUser = user;
    if (user) {
      // ログイン中：ログインフォームとログインボタンを隠し、アカウント情報を見せる。
      loginForm.hidden = true;
      loginToggle.hidden = true;
      accountBox.hidden = false;
      loginInfo.textContent = "ログインしました（" + user.email + "）";
      newButton.hidden = false; // ＋新規登録はログイン中だけ
    } else {
      // 未ログイン：ログインフォームは既定で隠し（トグルで開く）、
      //             ログインボタンを見せ、アカウント情報を隠す。
      loginForm.hidden = true;
      loginToggle.hidden = false;
      accountBox.hidden = true;
      loginInfo.textContent = "";
      newButton.hidden = true; // 未ログインでは＋新規登録を隠す
    }

    // ログイン状態が変わったら一覧を読み込み直す。
    loadKnowledgeList(db);
  }

  // 知識の登録フォームの準備をする（ログイン処理とは独立した処理）。
  setupKnowledge(db);

  // --- 最初に「すでにログイン済みか？」を確認する ------------
  // Supabase はログイン状態をブラウザに保存するので、
  // ページを開き直しても、前回ログインしていればログインのまま。
  db.auth.getSession().then(function (result) {
    const session = result.data.session; // ログインしていなければ null
    updateView(session ? session.user : null);
  });

  // --- ログインフォームが送信されたときの処理 ---------------
  loginForm.addEventListener("submit", async function (event) {
    // フォーム送信のデフォルト動作（ページ再読み込み）を止める。
    event.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    showStatus("ログイン中…", false);

    // Supabase にメール＋パスワードでログインを依頼する。
    // 結果は { data, error } の形で返ってくる。
    const { data, error } = await db.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      // 失敗：原因はコンソールへ、分かりやすい文言は画面へ。
      console.error("❌ ログイン失敗:", error);
      showStatus(
        "❌ ログインに失敗しました。メールアドレスとパスワードを確認してください。",
        true
      );
      return;
    }

    // 成功：入力したパスワードは画面から消しておく（安全のため）。
    passwordInput.value = "";
    showStatus("✅ ログインしました（" + data.user.email + "）", false);
    updateView(data.user);
  });

  // --- ログアウトボタンが押されたときの処理 -----------------
  logoutButton.addEventListener("click", async function () {
    const { error } = await db.auth.signOut();
    if (error) {
      console.error("❌ ログアウト失敗:", error);
      showStatus("❌ ログアウトに失敗しました: " + error.message, true);
      return;
    }
    showStatus("ログアウトしました", false);
    updateView(null); // 未ログインの画面に戻す
  });
}

// ============================================================
// ここから下：画面切り替え（ホーム／詳細／編集）
// ============================================================
// 3つの画面エリア（#view-home / #view-detail / #view-edit）のうち、
// 1つだけを表示し、残りを隠すことで「画面が切り替わった」ように見せる。
// ------------------------------------------------------------

// (N-1) 画面切り替え：name は "home" / "detail" / "edit" のいずれか。
function showView(name) {
  const home = document.getElementById("view-home");
  const detail = document.getElementById("view-detail");
  const edit = document.getElementById("view-edit");

  // 該当する1つだけ hidden=false（表示）、残りは hidden=true（非表示）。
  home.hidden = name !== "home";
  detail.hidden = name !== "detail";
  edit.hidden = name !== "edit";

  // 画面が変わったらページ先頭まで戻す（長い内容でも上から読めるように）。
  window.scrollTo(0, 0);
}

// (N-2) 詳細表示：1件の知識を詳細画面に表示して、その画面へ切り替える。
function showDetail(db, item) {
  // どの知識を表示中かを覚える（詳細画面の編集・削除ボタンから参照する）。
  currentDetailItem = item;

  const content = document.getElementById("detail-content");
  // いったん中身を空にしてから、項目を組み立てて入れる。
  content.innerHTML = "";

  // タイトル（見出し）。
  const titleEl = document.createElement("h2");
  titleEl.textContent = item.title;
  content.appendChild(titleEl);

  // 「AIの説明」「自分のまとめ」を、色付きの枠＋バッジで作る部品。
  //   extraClass = "field-ai" / "field-mine" で色分けする。
  //   値が無い項目では呼ばない＝枠ごと表示しない。
  function addFieldBlock(label, value, extraClass) {
    const block = document.createElement("div");
    block.className = "field-block " + extraClass;

    // 小さなラベル（バッジ）。
    const badge = document.createElement("span");
    badge.className = "field-badge";
    badge.textContent = label;

    // 本文。
    const body = document.createElement("p");
    body.textContent = value;

    block.appendChild(badge);
    block.appendChild(body);
    content.appendChild(block);
  }

  // 「見出し＋本文」だけのシンプルな部品（出典・タグ用。枠で囲わない）。
  function addPlainBlock(label, value) {
    const heading = document.createElement("h3");
    heading.textContent = label;
    const body = document.createElement("p");
    body.textContent = value;
    content.appendChild(heading);
    content.appendChild(body);
  }

  // 値があるものだけ表示する。
  // AIの説明・自分のまとめは色付き枠（バッジ付き）で視覚的に分ける。
  if (item.ai_explanation) {
    addFieldBlock("AIの説明", item.ai_explanation, "field-ai");
  }
  if (item.my_summary) {
    addFieldBlock("自分のまとめ", item.my_summary, "field-mine");
  }
  // 出典・タグはこれまでどおりの見せ方。
  if (item.source) addPlainBlock("出典", item.source);
  if (item.tags && item.tags.length > 0) {
    addPlainBlock("タグ", item.tags.join(", "));
  }

  // 編集・削除ボタンは、ログイン中(currentUser がある)のときだけ表示する。
  const editButton = document.getElementById("detail-edit-button");
  const deleteButton = document.getElementById("detail-delete-button");
  editButton.hidden = !currentUser;
  deleteButton.hidden = !currentUser;

  // 詳細画面へ切り替える。
  showView("detail");
}

// (N-3) 画面切り替え用ボタンの配線（新規・戻る・編集・削除）。
function setupNavigation(db) {
  const newButton = document.getElementById("new-button");
  const backButton = document.getElementById("detail-back-button");
  const detailEditButton = document.getElementById("detail-edit-button");
  const detailDeleteButton = document.getElementById("detail-delete-button");

  // 「＋ 新規登録」：新規モードにしてから編集画面へ。
  newButton.addEventListener("click", function () {
    exitEditMode();     // 既存関数：フォームを空にして新規モードに
    showView("edit");
  });

  // 「← 一覧に戻る」：ホーム画面へ。
  backButton.addEventListener("click", function () {
    showView("home");
  });

  // 詳細画面の「編集」：いま表示中の知識をフォームに読み込んで編集画面へ。
  detailEditButton.addEventListener("click", function () {
    if (!currentDetailItem) return;
    enterEditMode(currentDetailItem); // 既存関数：内容をフォームへ
    showView("edit");
  });

  // 詳細画面の「削除」：確認付き削除（既存関数）。成功したらホームへ。
  detailDeleteButton.addEventListener("click", async function () {
    if (!currentDetailItem) return;
    const deleted = await deleteKnowledge(db, currentDetailItem);
    if (deleted) {
      showView("home");
    }
  });
}

// ============================================================
// ここから下：知識の登録・一覧表示・編集・削除
// ============================================================
// やること：
//   1. フォーム送信時、入力チェックをして knowledge に保存
//      （新規登録モード = insert / 編集モード = update を切り替える）
//   2. 一覧の各件に「編集」「削除」ボタンを出す（ログイン中だけ）
//   3. 削除は確認を挟んでから削除し、一覧を更新する
//   4. 編集はフォームに内容を読み込み、「更新する」で保存する
//
// ※ 検索やデザインの作り込みは、まだしません。
// ------------------------------------------------------------

// (1) 登録フォームの準備：送信されたときの処理を登録する。
function setupKnowledge(db) {
  const form = document.getElementById("knowledge-form");
  const cancelButton = document.getElementById("cancel-button");

  // フォーム送信＝「登録する」または「更新する」が押されたとき。
  form.addEventListener("submit", async function (event) {
    // フォーム送信時のページ再読み込みを止める。
    event.preventDefault();

    // --- 入力値を取り出す（前後の空白は .trim() で削る） ---
    const title = document.getElementById("title").value.trim();
    const aiExplanation = document.getElementById("ai_explanation").value.trim();
    const mySummary = document.getElementById("my_summary").value.trim();
    const source = document.getElementById("source").value.trim();
    const tagsRaw = document.getElementById("tags").value;

    // --- 入力チェック（新規でも編集でも同じルール） -------
    // タイトルは必須。
    if (title === "") {
      showStatus("❌ タイトルは必須です。", true);
      return;
    }
    // AIの説明 と 自分のまとめ は、どちらか一方は必須。
    if (aiExplanation === "" && mySummary === "") {
      showStatus(
        "❌「AIの説明」か「自分のまとめ」のどちらか一方は入力してください。",
        true
      );
      return;
    }

    // --- タグをカンマ区切りの文字列 → 配列に変換 -----------
    // 例: "歴史, 科学 ,, メモ" → ["歴史","科学","メモ"]
    //   split(",")        … カンマで分割
    //   map(t => t.trim()) … 各タグの前後空白を削る
    //   filter(...)       … 空になったもの（連続カンマなど）を捨てる
    const tags = tagsRaw
      .split(",")
      .map(function (t) {
        return t.trim();
      })
      .filter(function (t) {
        return t !== "";
      });

    // テーブルに渡すデータ。キー名は knowledge の列名と一致させる。
    // 任意項目が空文字のときは null を入れておく（空の印）。
    const record = {
      title: title,
      ai_explanation: aiExplanation || null,
      my_summary: mySummary || null,
      source: source || null,
      tags: tags, // tags 列は text[]（配列型）なので配列をそのまま渡す
    };

    // --- 新規登録 か 編集 かで処理を分ける -----------------
    let error;
    if (editingId === null) {
      // 新規登録モード：insert で新しい行を追加する。
      showStatus("保存中…", false);
      const result = await db.from("knowledge").insert(record);
      error = result.error;
    } else {
      // 編集モード：update で、id が一致する行を書き換える。
      //   .eq("id", editingId) =「id 列が editingId と等しい行だけ」を対象にする。
      //   これを付け忘れると全行が書き換わってしまうので必須。
      showStatus("更新中…", false);
      const result = await db
        .from("knowledge")
        .update(record)
        .eq("id", editingId);
      error = result.error;
    }

    if (error) {
      console.error("❌ 保存に失敗:", error);
      showStatus("❌ 保存に失敗しました: " + error.message, true);
      return;
    }

    // --- 保存成功 -----------------------------------------
    showStatus(editingId === null ? "✅ 保存しました。" : "✅ 更新しました。", false);
    exitEditMode();        // フォームを空にして新規登録モードへ戻す
    loadKnowledgeList(db); // 一覧を読み込み直して、変更を反映する
    loadTagList(db);       // タグが増減した可能性があるのでタグ一覧も更新
    showView("home");      // 保存できたらホーム（一覧）画面へ戻る
  });

  // キャンセルボタン：編集をやめて新規登録モードに戻し、ホームへ戻る。
  cancelButton.addEventListener("click", function () {
    exitEditMode();
    showStatus("編集をやめました。", false);
    showView("home");
  });
}

// (1-b) 編集モードに入る：選んだ知識の内容をフォームに読み込む。
function enterEditMode(item) {
  // どの行を編集中かを覚える（フォーム送信時に使う）。
  editingId = item.id;

  // 現在の内容をフォームの各入力欄に入れる。
  document.getElementById("title").value = item.title || "";
  document.getElementById("ai_explanation").value = item.ai_explanation || "";
  document.getElementById("my_summary").value = item.my_summary || "";
  document.getElementById("source").value = item.source || "";
  // tags は配列なので、表示用にカンマ区切りの文字列へ戻す。
  document.getElementById("tags").value = item.tags ? item.tags.join(", ") : "";

  // 見た目を「編集モード」に切り替える。
  document.getElementById("form-title").textContent = "知識を編集";
  document.getElementById("submit-button").textContent = "更新する";
  document.getElementById("cancel-button").hidden = false; // キャンセルを出す

  // 入力欄が見えるようフォームまでスクロールする（親切機能）。
  document.getElementById("knowledge-form").scrollIntoView();
}

// (1-c) 編集モードを抜ける：フォームを空にして新規登録モードへ戻す。
function exitEditMode() {
  editingId = null; // 「編集中ではない」状態に戻す
  document.getElementById("knowledge-form").reset(); // 入力欄を空にする

  // 見た目を「新規登録モード」に戻す。
  document.getElementById("form-title").textContent = "知識を登録";
  document.getElementById("submit-button").textContent = "登録する";
  document.getElementById("cancel-button").hidden = true; // キャンセルを隠す
}

// (1-d) 削除：確認を挟んでから、その知識をテーブルから消す。
//   戻り値: 削除できたら true、キャンセル/失敗なら false。
//   （呼び出し側が「成功したら画面を切り替える」判断に使えるようにするため）
async function deleteKnowledge(db, item) {
  // window.confirm はブラウザ標準の確認ダイアログ。
  // 「OK」で true、「キャンセル」で false が返る。
  const ok = window.confirm("「" + item.title + "」を本当に削除しますか？");
  if (!ok) {
    return false; // キャンセルされたら何もしない
  }

  // id が一致する行だけを削除する（.eq の付け忘れに注意）。
  showStatus("削除中…", false);
  const { error } = await db.from("knowledge").delete().eq("id", item.id);

  if (error) {
    console.error("❌ 削除に失敗:", error);
    showStatus("❌ 削除に失敗しました: " + error.message, true);
    return false;
  }

  // もし削除した行を編集中だったら、編集モードも解除しておく。
  if (editingId === item.id) {
    exitEditMode();
  }

  showStatus("✅ 削除しました。", false);
  loadKnowledgeList(db); // 一覧を更新する
  loadTagList(db);       // タグが減った可能性があるのでタグ一覧も更新
  return true;
}

// (2) 一覧の読み込みと表示。
//     ページ表示時・ログイン時・保存成功時に呼ばれる。
async function loadKnowledgeList(db) {
  const listBox = document.getElementById("knowledge-list");

  // --- 検索条件をクエリ（DBへの問い合わせ）に組み立てる -----
  // まず土台を作る。select("*") = すべての列を取る。
  let query = db.from("knowledge").select("*");

  // (a) キーワード検索：title / ai_explanation / my_summary の
  //     いずれかに含まれていれば対象（部分一致）。
  //     ilike = 大文字小文字を区別しない部分一致。
  //     %xxx% の % は「前後に何があってもよい」という意味。
  //     .or(...) = カンマで並べた条件の「どれか1つ」を満たせばOK。
  if (currentKeyword !== "") {
    const kw = "%" + currentKeyword + "%";
    query = query.or(
      "title.ilike." + kw +
      ",ai_explanation.ilike." + kw +
      ",my_summary.ilike." + kw
    );
  }

  // (b) タグ絞り込み：tags 配列に currentTag が含まれる行だけ。
  //     .contains("tags", [tag]) = 配列がそのタグを含むか。
  //   キーワードと併用すると、(a) と (b) の両方を満たす＝AND になる。
  if (currentTag !== null) {
    query = query.contains("tags", [currentTag]);
  }

  // 新しい順に並べる（※ created_at 列が無い場合はこの行を消す）。
  query = query.order("created_at", { ascending: false });

  // ここで実際に DB へ問い合わせる。
  const { data, error } = await query;

  if (error) {
    console.error("❌ 一覧の取得に失敗:", error);
    listBox.textContent = "一覧の取得に失敗しました: " + error.message;
    return;
  }

  // 件数表示を更新する（絞り込み後の件数 = data の件数）。
  const filteredCount = data ? data.length : 0;
  updateCountStatus(db, filteredCount);

  // 1件も無いときの表示。
  // 検索条件があるかどうかで、メッセージを分かりやすく変える。
  if (!data || data.length === 0) {
    const hasFilter = currentKeyword !== "" || currentTag !== null;
    listBox.textContent = hasFilter
      ? "条件に合う知識は見つかりませんでした。"
      : "まだ知識が登録されていません。";
    return;
  }

  // --- 取得した各件を画面に並べる -----------------------
  // いったん中身を空にしてから、1件ずつ作って追加していく。
  listBox.innerHTML = "";
  data.forEach(function (item) {
    // 1件分の入れ物。
    const card = document.createElement("div");

    // 一覧は「タイトルのみ」表示にする。クリックで詳細画面へ移動する。
    //   ※ AIの説明・自分のまとめ・出典・タグは一覧では出さず、詳細画面で見せる。
    //     一覧はタイトルだけのスッキリした行にして探しやすくする。
    const titleEl = document.createElement("h3");
    titleEl.textContent = item.title;
    titleEl.style.cursor = "pointer"; // クリックできると分かるように
    titleEl.addEventListener("click", function () {
      showDetail(db, item);
    });
    card.appendChild(titleEl);

    // 件ごとの区切り線を入れて、入れ物を一覧に追加。
    card.appendChild(document.createElement("hr"));
    listBox.appendChild(card);
  });
}

// (2-b) 件数表示を更新する。
//   filteredCount = いま一覧に出ている（絞り込み後の）件数。
//   全体の総件数は、件数だけを数える軽い問い合わせで別途取得する。
async function updateCountStatus(db, filteredCount) {
  const countEl = document.getElementById("count-status");

  // 全体の総件数を取得する。
  //   count: "exact" で正確な件数を、head: true でデータ本体は取らず件数だけ。
  const { count, error } = await db
    .from("knowledge")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("❌ 件数の取得に失敗:", error);
    countEl.textContent = "";
    return;
  }

  const total = count || 0;

  // 絞り込み中かどうかで表示を出し分ける。
  if (currentKeyword === "" && currentTag === null) {
    // 絞り込みなし：全件表示。
    countEl.textContent = "全" + total + "件";
  } else {
    // 絞り込みあり：見つかった件数と全体件数の両方を見せる。
    countEl.textContent =
      filteredCount + "件見つかりました（全" + total + "件中）";
  }
}

// ============================================================
// ここから下：検索・絞り込み
// ============================================================
// やること：
//   1. キーワード検索ボタン／Enter で currentKeyword を更新して再表示
//   2. タグボタンを押すと currentTag を更新して再表示
//   3. クリアボタンで条件を全部消して全件表示に戻す
//   4. 使われているタグの一覧（ボタン）を作る
//
// 実際の絞り込み（DBへの問い合わせ）は loadKnowledgeList が行う。
// ここは「条件を変えて、一覧を読み込み直す」役割。
// ------------------------------------------------------------

// (3) 検索・絞り込みの操作を準備する。
function setupSearch(db) {
  const searchInput = document.getElementById("search-input");
  const searchButton = document.getElementById("search-button");
  const resetButton = document.getElementById("reset-button");

  // キーワード検索を実行する小さな関数。
  function runSearch() {
    // 入力された文字を条件にして、一覧を読み込み直す。
    currentKeyword = searchInput.value.trim();
    updateFilterStatus();
    loadKnowledgeList(db);
  }

  // 「検索」ボタンを押したとき。
  searchButton.addEventListener("click", runSearch);

  // 入力欄で Enter を押したときも検索する（使い勝手のため）。
  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      runSearch();
    }
  });

  // 「クリア（全件表示）」ボタン：条件を全部消して全件に戻す。
  resetButton.addEventListener("click", function () {
    currentKeyword = "";
    currentTag = null;
    searchInput.value = "";
    updateFilterStatus();
    loadKnowledgeList(db);
  });
}

// (3-b) いま選んでいる絞り込み条件を画面に表示する。
function updateFilterStatus() {
  const statusEl = document.getElementById("filter-status");
  const parts = [];
  if (currentKeyword !== "") {
    parts.push("キーワード「" + currentKeyword + "」");
  }
  if (currentTag !== null) {
    parts.push("タグ「" + currentTag + "」");
  }
  // 条件があれば説明文、無ければ「全件表示中」と出す。
  statusEl.textContent =
    parts.length > 0 ? parts.join(" かつ ") + " で絞り込み中" : "全件表示中";
}

// (4) 使われているタグの一覧（ボタン）を作る。
//     全データの tags を集めて、重複を除いてボタンにする。
async function loadTagList(db) {
  const tagListBox = document.getElementById("tag-list");

  // tags 列だけを全行ぶん取得する（軽い問い合わせ）。
  const { data, error } = await db.from("knowledge").select("tags");
  if (error) {
    console.error("❌ タグ一覧の取得に失敗:", error);
    return;
  }

  // 全行の tags をひとつにまとめて、重複を取り除く。
  //   Set =「重複を持たない集合」。ここに入れると重複が消える。
  const tagSet = new Set();
  data.forEach(function (row) {
    if (row.tags) {
      row.tags.forEach(function (tag) {
        tagSet.add(tag);
      });
    }
  });

  // いったん中身を空にしてから、タグボタンを並べ直す。
  tagListBox.innerHTML = "";

  if (tagSet.size === 0) {
    tagListBox.textContent = "（まだタグがありません）";
    return;
  }

  // 1タグ＝1ボタン。押すとそのタグで絞り込む。
  tagSet.forEach(function (tag) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tag;
    button.addEventListener("click", function () {
      currentTag = tag; // このタグで絞り込む
      updateFilterStatus();
      loadKnowledgeList(db);
    });
    tagListBox.appendChild(button);
  });
}
