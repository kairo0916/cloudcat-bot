## 雲喵AI - 中文Discord Bot
*一個功能豐富且支援多種功能的機器人！*

## ✨ 功能特色
### 🏠 伺服器管理
- 進退訊息系統
- MC伺服器狀態監控
- 多伺服器獨立
- AI對話系統
- AI模型失敗輪替系統
### 🎟️ 客服單系統
- 客服單一鍵設置
- 自由調整內容
- 管理員權限控制
- 客服單分類
### 🎂 生日系統
- 生日設定
- 生日祝福
- 生日祝福頻道
### 🤖 AI對話系統
- 上下文記憶
- 獨立用戶長期記憶
- 雙模型運作

### 😱 還有更多功能等你挖掘！

## 📦 系統需求
- Node.js v18+
- npm 
- Discord Bot Token（請妥善保管）
#### 可選：
- **MongoDB** 儲存資料（若不使用將使用JSON保存資料）
- **Gemini APIKEY or Cohere** APIKEY （擇一或全部都要）

## 🚀 安裝方法
1. **下載專案**
```
git clone URL
cd bot
```

2. **安裝依賴**
```
npm install
```

3. **修改變數**
將 `.env.example` 重命名為 `.env` 並修改以下參數：
```
DISCORD_TOKEN=
BOT_NAME=
FOOTER=
PREFIX=$

MODEL=gemini
# 可選 gemini 或是 cohere

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
COHERE_API_KEY=
COHERE_MODEL=command-a-plus-05-2026
VISION_MODEL=gemini-3-flash-preview

MODEL_NAME=
# 可自訂你的模型名稱（沒用處）


DEV_USERS=
# 管理員ID1,管理員ID2（以此類推）
ADMIN_ID=
# 管理員ID

PTERO_URL=
PTERO_API_KEY=
PTERO_SERVER_ID=
# PTERODACTYL設定（未填寫將無法使用$server指令）

MONGODB_URL=
# 將整串URL放上來

LOG_CHANNEL_ID=
# 日誌頻道ID（未完善）

TIME_FORMAT=YYYY-MM-DD HH:mm:ss
TIME_ZONE=Asia/Taipei

AI_MEMORY_LIMIT=
# 上下文上限（例如500句就填500）

SEARCH_API_KEY=
SEARCH_ENGINE_ID=
# 搜尋功能無法使用（填了也沒用）

SEARCH_ALWAYS=false
SEARCH_DEBUG=false

AGENT_MAX_ROUNDS=3
VERBOSE_ERRORS=true
```

4. **啟動機器人**
```
node bot.js
```

## 🗄️ 資料儲存方式
*本專案的機器人支援兩種儲存方式*：
### 1. MongoDB 資料庫（推薦）
**修改以下參數**：
```
DATABASE_ENABLE=true
```
**需要**：
```
MONGODB_URL=
```

##### 適合：
- 主機儲存空間不足
- 長期運作
- 安全性

### 2. JSON檔案（傳統）
**修改以下參數**：
```
DATABASE_ENABLE=false
```
**啟動後自動創建需要的資料夾及檔案**

##### 適合：
- 本地測試
- 第一次部署
- 無資料庫

## 🔐 安全事項
1. **勿將.env裡的任何內容進行公開**（很危險）
2. **MONGODB 連結勿公開**（除非你允許）

## 🤝 歡迎貢獻
##### 歡迎提交：
- **Pull Request**
- **Issue**
- **Bug 回報**
- **新功能**

##### 提交 PR 前請確認：
- **代碼可正常運行**
- **無語法錯誤**
- **不包含敏感資訊（*TOKEN, API 等*）**

## 📕 許可證
**本專案採用 MIT License**

## 🙏 特別感謝
**感謝所有與我一起測試的開發者！**


**如果這個專案對你有幫助，還請給個Star支持一下！⭐**
