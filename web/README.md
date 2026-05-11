# Airforce API Proxy

An OpenAI-compatible API proxy for `api.airforce`, designed to bypass rate limits through key rotation and request queuing.

## Architecture

This project is split into two main components:

- **Web (Next.js)**: The frontend user interface for chat and administration.
- **API (Bun + Hono)**: The backend proxy that handles request queuing, key rotation, and communication with the upstream Airforce API.

## Features

- **Queue System**: Redis-backed queue with configurable maximum size and 15-minute timeouts.
- **Key Rotation**: Cycles through a pool of API keys to respect the 1 RPM limit of free accounts.
- **Admin Dashboard**: Secure management of API keys and real-time analytics.
- **Streaming Support**: Full support for Server-Sent Events (SSE) for a responsive chat experience.

## Setup

### Environment Variables

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Connection string for the Redis instance. |
| `ADMIN_PASSWORD` | Password for accessing the admin dashboard and API. |
| `APP_ENDPOINT` | The public URL of the application. |

### Development

Run the following commands in the root directory:

```bash
# Start the API component
cd api
bun run index.ts

# Start the Web component
cd web
bun run dev
```

## Deployment

This project is optimized for deployment on [Diploi](https://diploi.com).

1. Connect your repository to Diploi.
2. Configure the required environment variables in the project settings.
3. Deploy!
