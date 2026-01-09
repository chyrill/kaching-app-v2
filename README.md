# kaching - BIR-Compliant Receipt Management

Philippine e-commerce receipt management platform with automatic BIR compliance, Shopee integration, and real-time inventory tracking.

## Quick Start (< 5 minutes)

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **pnpm** - Install with: `npm install -g pnpm`
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)

### Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start local services** (PostgreSQL + Redis):
   ```bash
   ./scripts/dev-setup.sh
   ```

3. **Run development server**:
   ```bash
   pnpm dev
   ```

4. **Open application**:
   - Navigate to [http://localhost:3000](http://localhost:3000)

That's it! Your local environment is ready. 🎉

---

## Database Setup

The project uses **PostgreSQL** with **Prisma ORM**. The database schema is defined in `prisma/schema.prisma`.

### Database Commands

- **Push schema changes** (for rapid development):
  ```bash
  pnpm db:push
  ```
  Use this during development when you want to sync schema changes without creating migration files.

- **Create a migration** (for production):
  ```bash
  pnpm db:migrate:dev
  ```
  Creates a timestamped migration file in `prisma/migrations/` and applies it.

- **Open Prisma Studio** (visual database browser):
  ```bash
  pnpm db:studio
  ```
  Opens at [http://localhost:5555](http://localhost:5555) - inspect and edit database records visually.

- **Seed development data**:
  ```bash
  pnpm db:seed
  ```
  Creates test user and shop for local development.

### Troubleshooting Database Issues

**"Environment variable not found: DATABASE_URL"**

Ensure Docker PostgreSQL is running:
```bash
docker ps | grep kaching-postgres
```

If not running:
```bash
./scripts/dev-setup.sh
```

**"Connection refused" or "Can't reach database server at `localhost:5432`"**

Check if port 5432 is in use by another process:
```bash
lsof -i :5432
```

If another PostgreSQL is running, stop it or change the Docker port in `docker-compose.yml`.

**"Database sync failed"**

Reset the database and recreate tables:
```bash
docker-compose down -v  # Deletes all data
docker-compose up -d
pnpm db:push
```

---

## Troubleshooting

### "Docker not installed or not running"

**Solution**:
1. Install Docker Desktop from https://docker.com
2. Start Docker Desktop application
3. Wait for Docker daemon to start (whale icon appears in system tray)
4. Run `./scripts/dev-setup.sh` again

### "Port 5432 already in use"

Another PostgreSQL instance is running.

**macOS**:
```bash
brew services stop postgresql
```

**Linux**:
```bash
sudo systemctl stop postgresql
```

**Or** change the port in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"  # Change 5432 to 5433
```

Then update `DATABASE_URL` in `.env` to use port 5433.

### "Port 6379 already in use"

Another Redis instance is running.

**macOS**:
```bash
brew services stop redis
```

**Linux**:
```bash
sudo systemctl stop redis
```

**Or** change the port in `docker-compose.yml`:
```yaml
ports:
  - "6380:6379"  # Change 6379 to 6380
```

Then update `REDIS_URL` in `.env` to use port 6380.

### "Cannot connect to database"

**Check services are running**:
```bash
docker-compose ps
```

Expected output: Both `postgres` and `redis` show "Up" status and "healthy".

**View service logs**:
```bash
# PostgreSQL logs
docker-compose logs postgres

# Redis logs
docker-compose logs redis

# All logs
docker-compose logs -f
```

**Restart services**:
```bash
docker-compose restart
```

**Complete reset** (deletes all data):
```bash
docker-compose down -v
./scripts/dev-setup.sh
```

### "Permission denied: ./scripts/dev-setup.sh"

Make the script executable:
```bash
chmod +x scripts/dev-setup.sh
```

### Services won't start or become healthy

**Check Docker resources** (Docker Desktop → Settings → Resources):
- Minimum 4 GB RAM allocated
- Minimum 2 CPUs allocated

**Check Docker disk space**:
```bash
docker system df
```

**Clean up old Docker data**:
```bash
docker system prune -a --volumes
```

---

## Development Commands

### Start development server
```bash
pnpm dev
```

### Build for production
```bash
pnpm build
```

### Run production build locally
```bash
pnpm preview
```

### Type checking
```bash
pnpm typecheck
```

### Linting
```bash
pnpm lint          # Check for errors
pnpm lint:fix      # Auto-fix errors
```

### Formatting
```bash
pnpm format:check  # Check formatting
pnpm format:write  # Auto-format files
```

### Database commands
```bash
pnpm db:push       # Push schema changes to database
pnpm db:studio     # Open Prisma Studio (database GUI)
pnpm db:generate   # Generate Prisma client
pnpm db:migrate    # Run migrations
```

---

## Stopping Development Environment

### Stop services (keep data)
```bash
docker-compose down
```

### Stop services and delete all data
```bash
docker-compose down -v
```

### View running containers
```bash
docker ps
```

### View all containers (including stopped)
```bash
docker ps -a
```

---

## Technology Stack

This project uses the [T3 Stack](https://create.t3.gg/):

- **[Next.js 15](https://nextjs.org)** - React framework with App Router
- **[TypeScript 5](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[tRPC 11](https://trpc.io)** - End-to-end typesafe APIs
- **[Prisma 6](https://prisma.io)** - Database ORM
- **[NextAuth.js v5](https://next-auth.js.org)** - Authentication
- **[Tailwind CSS 4](https://tailwindcss.com)** - Utility-first CSS
- **[PostgreSQL 16](https://www.postgresql.org/)** - Database
- **[Redis 7](https://redis.io/)** - Caching & queues

Additional libraries:
- **Socket.IO** - Real-time WebSocket communication
- **BullMQ** - Background job processing
- **Zod** - Runtime type validation

---

## Project Structure

```
kaching-app/
├── prisma/              # Database schema & migrations
├── public/              # Static assets
├── scripts/             # Development scripts
├── src/
│   ├── app/            # Next.js App Router pages
│   ├── server/         # Server-side code (tRPC, auth)
│   ├── trpc/           # tRPC client configuration
│   └── styles/         # Global CSS
├── storage/            # Local file storage (gitignored)
├── docker-compose.yml  # Docker services
└── .env                # Environment variables (gitignored)
```

---

## Learn More

- [T3 Stack Documentation](https://create.t3.gg/)
- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)

---

## Deployment

Follow deployment guides for:
- [Vercel](https://create.t3.gg/en/deployment/vercel)
- [Docker](https://create.t3.gg/en/deployment/docker)

---

*Built with ❤️ for Philippine e-commerce sellers*
