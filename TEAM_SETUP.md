# 🚀 Team Setup Guide - SemiConLabs

## For New Team Members

### 📋 Prerequisites
- Node.js (v16 or higher)
- Docker Desktop
- Git

---

## ⚙️ Setup Steps

### 1️⃣ Install Docker Desktop
- Download: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop
- Verify: `docker --version`

### 2️⃣ Clone Repository
```bash
git clone <your-repo-url>
cd semiconlabs
```

### 3️⃣ Install Dependencies
```bash
npm install
```

### 4️⃣ Setup Environment Variables
Create `.env` file:
```env
DB_HOST=localhost
DB_PORT=5434
DB_USER=postgres
DB_PASSWORD=Ranjitha@2003
DB_NAME=semiconlabs

JWT_SECRET=your-secret-key-here-change-this-in-production-semiconlabs-2025
```

### 5️⃣ Start Database
```bash
docker-compose up -d
```

**Verify it's running:**
```bash
docker ps
```

You should see:
```
PORTS
0.0.0.0:5434->5432/tcp
```

### 6️⃣ Start Application
```bash
npm run start:dev
```

---

## 🎯 Important: Use ONLY Port 5434

**Everyone on the team uses:**
- ✅ Port: **5434**
- ✅ Database: **semiconlabs**
- ✅ User: **postgres**

**Do NOT use:**
- ❌ Port 5432 or 5433
- ❌ Local PostgreSQL installations

---

## 🔌 Connect to Database (PgAdmin/DataGrip)

| Setting | Value |
|---------|-------|
| Host | localhost |
| Port | **5434** |
| Database | semiconlabs |
| Username | postgres |
| Password | Ranjitha@2003 |

---

## 📝 Daily Workflow

### Starting Work:
```bash
# Start database (if not running)
docker-compose up -d

# Start app
npm run start:dev
```

### Ending Work:
```bash
# Stop app (Ctrl + C)

# Optional: Stop database
docker-compose down
# Note: Your data is saved and will be there tomorrow
```

---

## 🆘 Troubleshooting

### Problem: Port 5434 already in use
**Solution:**
```bash
docker-compose down
docker-compose up -d
```

### Problem: Database connection refused
**Solution:**
```bash
# Check if Docker is running
docker ps

# If not, start it
docker-compose up -d
```

### Problem: No data in database
**Solution:**
```bash
# Restore from backup
.\restore-docker-database.ps1
```

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Docker Desktop is running
- [ ] `docker ps` shows semiconlabs_postgres on port 5434
- [ ] Application starts without errors
- [ ] Can connect to database on port 5434
- [ ] API endpoints respond correctly

---

## 📞 Need Help?

Contact your team lead if:
- Docker won't start
- Can't connect to database
- Port conflicts
- Missing data

---

**Remember: We ALL use Docker on port 5434. No exceptions!** 🎯


