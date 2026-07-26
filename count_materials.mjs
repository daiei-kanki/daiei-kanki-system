/**
 * Firestoreのmaterialsコレクションのドキュメント数をカウントする診断スクリプト
 * 実行方法: node --experimental-vm-modules count_materials.mjs
 * ※ ただし Firebase JS SDK はブラウザ向けのため、Node.jsからは firebase-admin が必要。
 *    このファイルはブラウザコンソール用のコードを表示するためのものです。
 */

// ============================================================
// ブラウザのDevTools（F12）コンソールに以下のコードを貼り付けてください：
// ============================================================

const BROWSER_CONSOLE_CODE = `
// アプリが開いている状態でF12 → コンソールに貼り付けて実行
(async () => {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js');
  const { getFirestore, collection, getCountFromServer } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js');
  
  const app = initializeApp({
    projectId: "gen-lang-client-0252940162",
    apiKey: "AIzaSyD71H8mkXIHc_zY1UspZBUMwKnZ9bZEJnI",
    authDomain: "gen-lang-client-0252940162.firebaseapp.com",
  }, "counter-app");
  
  const db = getFirestore(app);
  const snap = await getCountFromServer(collection(db, "materials"));
  console.log("🔢 materialsコレクションの実際のドキュメント数:", snap.data().count);
})();
`;

console.log("=".repeat(60));
console.log("ブラウザのF12 → コンソールに以下を貼り付けて実行してください:");
console.log("=".repeat(60));
console.log(BROWSER_CONSOLE_CODE);
