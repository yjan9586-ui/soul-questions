# 靈魂拷問 Soul Questions — 即時互動問答

學員用手機掃 QR Code 投票（免登入），主持人在 `host.html` 即時看到長條圖。
靜態網頁放在 GitHub Pages，票數存在 Firebase Realtime Database（免費方案）。

| 檔案 | 用途 |
|---|---|
| `index.html` | 學員頁（給 QR Code 的網址） |
| `host.html` | 主持人頁（需登入，上課時分享畫面） |
| `firebase-config.js` | 你的 Firebase 設定（要改） |
| `database.rules.json` | 資料庫權限規則（要改 HOST_EMAIL） |
| `app.js` `questions.js` `style.css` | 程式、題目文字、樣式 |

## 先預覽（不用設定任何東西）
直接部署或在本機開啟，沒有填 Firebase 設定時會進入「示範模式」：票數只在同一個瀏覽器的分頁間同步，可用來看畫面和操作。

## 設定步驟（約 15 分鐘）

**1. 建立 Firebase 專案**
到 console.firebase.google.com → 新增專案（Google Analytics 可不開）。

**2. 建立資料庫**
左側「建構 → Realtime Database」→ 建立資料庫 → 選一個地區 → 先選「以鎖定模式啟動」。

**3. 開啟登入方式**
「建構 → Authentication → 登入方式」開啟兩個：
- 匿名（Anonymous）：學員用，免登入。
- 電子郵件/密碼：主持人用。

接著到「Users」分頁，新增一個使用者，填你的 email 和密碼。這就是主持人帳號。

**4. 貼上權限規則**
Realtime Database →「規則」分頁，把 `database.rules.json` 的內容貼上，
並把兩處 `HOST_EMAIL` 改成你剛才建立的主持人 email，按「發布」。
規則的效果：任何人都能看結果；學員只能寫入自己的那一票；只有主持人帳號能改題目進度、隱藏、鎖定與清空。

**5. 取得網站設定**
專案設定（齒輪）→「你的應用程式」→ 新增網頁應用程式（</>）→ 複製 `firebaseConfig`，
貼到 `firebase-config.js`。`databaseURL` 要保留（Realtime Database 頁面上方也看得到）。
這組金鑰本來就會公開在網頁上，安全由第 4 步的規則負責。

**6. 放到 GitHub Pages**
把整個資料夾上傳到一個 GitHub 倉庫 → Settings → Pages → 來源選 `main` 分支根目錄。
幾分鐘後：
- 學員：`https://你的帳號.github.io/倉庫名稱/`
- 主持人：`https://你的帳號.github.io/倉庫名稱/host.html`

## 上課當天
1. 打開 `host.html` 登入，分享畫面給學員。
2. 控制台按「顯示 QR Code」，學員掃碼進入。
3. 在控制台切題，學員頁面會自動跟著切換。每題討論前可先「鎖定目前結果」。

## 測試清單
- 用另一支手機（不要登入任何帳號）掃碼投票，主持人畫面長條圖要即時變動。
- 學員改選答案，票數要跟著更新，不會重複計算。
- 學員關掉頁面、手機鎖屏後再回來，票仍在。
- 主持人按「對學員隱藏」，學員頁不顯示數字；按「清空本題重投」後票數歸零。

## 注意
- Firebase 免費方案的同時連線數有上限（約 100 人），請以官方說明為準。
- 主持人帳號建立後，請不要讓別人知道密碼；規則只認這個 email。
- 修改題目文字請編輯 `questions.js`。
