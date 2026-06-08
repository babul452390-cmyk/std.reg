# 🎓 EduRegister — Student Registration System

## 📁 Project Structure

```
student-app/
├── backend/
│   ├── server.js        ← Express API server
│   ├── package.json     ← Dependencies
│   └── data/
│       └── students.db  ← SQLite database (auto-created)
│
└── frontend/
    ├── index.html       ← Student Registration Page
    └── admin.html       ← Admin Panel
```

---

## 🚀 Setup & Run

### Step 1 — Backend Setup

```bash
cd backend
npm install
node server.js
```

Server runs at: **http://localhost:5000**

---

### Step 2 — Frontend

Just open the HTML files in browser (or use Live Server):

- **Student Registration:** `frontend/index.html`
- **Admin Panel:** `frontend/admin.html`

> ⚠️ Backend must be running BEFORE opening frontend.

---

## 🔐 Admin Login

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

---

## 📡 API Endpoints

| Method | Route                        | Auth | Description          |
|--------|------------------------------|------|----------------------|
| POST   | `/api/register`              | ❌   | Student registration |
| POST   | `/api/admin/login`           | ❌   | Admin login          |
| GET    | `/api/admin/students`        | ✅   | Get all students     |
| GET    | `/api/admin/students/:id`    | ✅   | Get one student      |
| PUT    | `/api/admin/students/:id`    | ✅   | Update student       |
| DELETE | `/api/admin/students/:id`    | ✅   | Delete student       |
| GET    | `/api/admin/stats`           | ✅   | Dashboard stats      |

---

## 🌐 Deploy করার জন্য

### Backend Deploy (Railway / Render)
1. Backend folder টি push করো GitHub-এ
2. Railway বা Render-এ new web service তৈরি করো
3. `npm install && node server.js` command দাও
4. Environment variable: `JWT_SECRET=your_secret_key`

### Frontend Deploy (Netlify / Vercel)
1. Frontend folder টি deploy করো
2. `admin.html` এবং `index.html`-এ `const API = 'http://localhost:5000'` পরিবর্তন করে deployed backend URL দাও
   - Example: `const API = 'https://your-app.railway.app'`

---

## 🛠 Tech Stack

- **Frontend:** Vanilla HTML + CSS + JavaScript
- **Backend:** Node.js + Express.js
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT + bcryptjs
