# Fonu Fullstack Assessment

NestJS API with a small Go reporting service.

## Requirements

- Node.js 22+ and pnpm
- Go 1.27+
- PostgreSQL

## Setup

1. Install Node dependencies:

   ```bash
   pnpm install
   ```

2. Install Go dependencies:

   ```bash
   cd services/reporting && go mod download && cd ../..
   ```

3. Copy `.env.example` to `.env` and fill in the values.

   > **Both servers will not start without these env variables.**

4. Run the database migrations:

   ```bash
   pnpm migration:run
   ```

## Run

```bash
pnpm run dev
```

Starts the API (port 3000) and the reporting service (port `REPORTING_PORT`, default 3001) together.
