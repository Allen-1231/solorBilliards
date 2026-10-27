# 線上對戰設計（尚未實作到前端）

**現況：前端只有「線上配對」大廳畫面，會如實告知服務未部署，並提供改打電腦。`server/server.js` 是尚未測試、也尚未與前端串接的骨架。真人對戰目前不能用。**

## 為什麼不是「各自模擬」
碰撞是混沌系統，不同瀏覽器的 `Math.exp/log` 末位誤差會讓同一桿打出不同結果。所以採用「**擊球方權威**」：

1. 輪到的玩家在自己的瀏覽器模擬整桿（沿用現有物理與規則 `resolveShot`）。
2. 模擬時每 1/30 秒錄下各球位置與落袋事件（`frames`），結束時送出 `result`（最終位置、落袋清單、犯規、下一位、勝負）。
3. 伺服器檢查「是不是輪到他」後轉送；對手瀏覽器只播放錄下的軌跡，最後把球校正到 `result` 的位置。
4. 缺點：擊球方可作弊。要防作弊需把物理與規則搬到 Node 做伺服器權威模擬（物理程式碼可抽成不依賴 DOM 的模組）。

## 訊息
| 方向 | 訊息 |
|---|---|
| C→S | `{t:'queue'}`、`{t:'cancel'}` |
| S→C | `{t:'matched', room, you:0|1, seed}`、`{t:'no_opponent'}`（等待 12 秒）、`{t:'opponent_left'}` |
| C→S→C | `{t:'shot', ang, power, spin}`、`{t:'frames', f:[...]}`、`{t:'result', balls, pocketed, foul, nextTurn, winner}` |

## 前端還需要做的事
- 大廳連線 `window.SOLAR_POOL_WS`（`wss://…`）、送 `queue`、倒數、逾時顯示「改打電腦」。
- 對手回合：停用輸入，播放 `frames`，套用 `result`。
- 斷線、重連、放棄的處理。

## 部署後端
GitHub Pages 只能放靜態檔。`server/` 要放在能長駐 WebSocket 的服務（Fly.io、Render、Railway 或自己的 VPS），並用 `wss://`。然後在 `index.html` 載入 `js/game.js` 之前加：`<script>window.SOLAR_POOL_WS='wss://你的網域';</script>`。
