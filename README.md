# Firebase to Notion Portfolio Sync

This service syncs your resume data from Firebase Realtime Database to a Notion resume page.

## 🌐 Tech Stack
- Firebase Realtime DB
- Notion API
- Node.js (deployed on Render.com)

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
Create a `.env` file based on `.env.example`.

### 3. Add Firebase Admin Key
Place your `serviceAccountKey.json` in the project root.

### 4. Run locally
```bash
node sync.js
```

### 5. Deploy on Render
- Create a **Background Worker**
- Connect your GitHub repo
- Set the start command: `node sync.js`
- Add environment variables in dashboard

Enjoy auto-sync magic! ✨
