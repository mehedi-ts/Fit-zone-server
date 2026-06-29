# 🏋️‍♂️ FitZone Server

FitZone Server is the backend API for the **FitZone Fitness & Gym Management Platform**. It handles authentication, role-based authorization, trainer applications, class management, bookings, Stripe payments, and community features.

---

## 🚀 Live API

**Server:** https://fit-zone-server.vercel.app/

---

## 🔑 Demo Admin Credentials

**Email:** `admin@gmail.com`

**Password:** `admin@gmail.com`

---

## ✨ Key Features

- 🔐 JWT Authentication with Better Auth
- 👥 Role-Based Authorization (Admin, Trainer & Member)
- 🧑‍🏫 Trainer Application System
- 🏋️ Class Management
- 📅 Class Booking System
- 💳 Stripe Payment Integration
- ⭐ Favorite Classes
- 💬 Community Forum
- 👍 Like & 👎 Dislike System
- 💭 Comments System
- 📄 Search, Filter & Pagination

---

## 🛠️ Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB

### Authentication
- Better Auth
- JWT
- Google OAuth

### Payment
- Stripe

---

## ⚙️ Environment Variables

Create a `.env` file in the project root.

```env
PORT=5000

MONGODB_URI=your_mongodb_uri

CLIENT_URL=http://localhost:3000

STRIPE_SECRET_KEY=your_stripe_secret_key

BETTER_AUTH_SECRET=your_better_auth_secret
```

---

## 📦 Installation

Clone the repository

```bash
git clone https://github.com/mehedi-ts/Fit-zone-server.git
```

Go to the project directory

```bash
cd Fit-zone-server
```

Install dependencies

```bash
npm install
```

Run the server

```bash
npm run dev
```

---

## 👨‍💻 Author

**Mehedi Hasan**

GitHub: https://github.com/mehedi-ts