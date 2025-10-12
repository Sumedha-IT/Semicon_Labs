# Semiconlabs Backend

A clean, production-ready NestJS backend with role-based access control for managing users, organizations, domains, and modules.

## 🔐 Security Setup

**IMPORTANT:** This project requires environment variables for security. Never commit `.env` or `docker-compose.yml` files with real credentials!

### 1. Environment Variables Setup

Copy the example file and add your real credentials:

```bash
cp .env.example .env
```

Then edit `.env` with your actual values:
- `DB_PASSWORD` - Your PostgreSQL password
- `JWT_SECRET` - A strong secret key (minimum 32 characters)

### 2. Docker Setup

Copy the example file and add your database password:

```bash
cp docker-compose.example.yml docker-compose.yml
```

Then edit `docker-compose.yml` and replace `YOUR_PASSWORD_HERE` with your actual PostgreSQL password.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15

### Installation

```bash
# Install dependencies
npm install

# Start PostgreSQL with Docker
docker-compose up -d

# Run database migrations
npm run migration:run

# Start the application
npm run start:dev
```

## 📁 Project Structure

```
src/
├── auth/           # Authentication & JWT
├── users/          # User management (cleaned & organized)
├── organizations/  # Organization management (cleaned & organized)
├── domains/        # Domain management
├── modules/        # Module management
├── user-domains/   # User-domain associations
├── user-modules/   # User-module enrollments
└── common/         # Shared utilities, guards, decorators
```

## ✨ Recent Improvements

### Code Cleanup (Latest)
- ✅ **UsersService**: Removed bulk operations, organized by role hierarchy
- ✅ **OrganizationsService**: Fixed critical `deleted_at` bug, removed 70+ lines of duplicate code
- ✅ **Security**: Removed all hardcoded passwords and secrets
- ✅ **Documentation**: Added JSDoc comments to all public methods
- ✅ **Organization**: Clear section headers and logical method grouping

## 🔑 User Roles

1. **PlatformAdmin** - System-wide access
2. **ClientAdmin** - Organization-wide access
3. **Manager** - Team management within organization
4. **Learner** - Individual user access

## 📚 API Documentation

The API follows RESTful conventions with role-based access control.

### Base URL
```
http://localhost:3000
```

### Authentication
All protected routes require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🛠️ Development

```bash
# Run in development mode
npm run start:dev

# Run linting
npm run lint

# Run tests
npm run test

# Build for production
npm run build
```

## 📝 License

MIT

---

**Note:** This is a clean, production-ready codebase with no hardcoded secrets or duplicate code. All services are well-organized and documented.

