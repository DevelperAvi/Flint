# Flint - Visual Social Platform

## Project Structure
```
flint/
├── apps/
│   ├── api/          # Node.js + Fastify backend
│   └── web/          # Next.js 14 frontend
├── packages/
│   └── types/        # Shared TypeScript types
├── docker-compose.yml
├── .env.example
└── turbo.json
```

## Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start infrastructure
docker-compose up -d

# 3. Install dependencies
npm install

# 4. Run database migrations
npm run db:migrate

# 5. Start development servers
npm run dev
```

## Services
- **API**: http://localhost:3001
- **Web**: http://localhost:3000
- **MinIO Console**: http://localhost:9001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
