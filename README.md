# Personal Nano Banana

AI Image Generator using Google's Nano Banana model via Replicate API.

## Features

- Generate images using AI with custom prompts
- Reference image support with automatic deduplication
- Session and batch management
- Mobile-first responsive design
- Docker deployment ready

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Replicate API token](https://replicate.com/account/api-tokens)

### Running Locally

1. Clone the repository
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Add your Replicate API token to `.env`
4. Start the backend:
   ```bash
   cd backend
   bun install
   bun --watch index.ts
   ```
5. Start the frontend (in a new terminal):
   ```bash
   cd frontend
   bun install
   bun run dev
   ```

## Docker Deployment

### Using Docker Compose

1. Create your `.env` file with required variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Replicate API token
   ```

2. Build and run with Docker Compose:
   ```bash
   # Build the image
   docker build -t personal-nano-banana:latest .
   
   # Run with docker-compose
   docker-compose up -d
   ```

### Environment Variables

- `REPLICATE_API_TOKEN`: Your Replicate API token (required)
- `DATABASE_PATH`: Path to SQLite database file (default: `database.sqlite`)
- `UPLOADS_DIR`: Directory for uploaded reference images (default: `uploads`)
- `GENERATED_IMAGES_DIR`: Directory for generated images (default: `generated`)
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: `3000`)

### Data Persistence

The Docker setup uses mounted volumes for persistent storage:
- `./data` on the host maps to `/app/data` in the container
- This includes the database, uploaded images, and generated images

## Project Structure

```
├── frontend/          # React frontend with TypeScript
├── backend/           # Bun backend with Hono framework
├── data/              # Persistent data (mounted in Docker)
├── Dockerfile         # Multi-stage Docker build
├── docker-compose.yml # Docker Compose configuration
└── .env.example       # Environment variables template
```

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, TanStack Query
- **Backend**: Bun, Hono, SQLite, Sharp
- **AI**: Replicate API (Google Nano Banana model)
- **Deployment**: Docker, Docker Compose