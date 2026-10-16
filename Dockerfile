FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c
COPY requirements-calendar.txt /opt/requirements-calendar.txt
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && python3 -m venv /opt/calendar && /opt/calendar/bin/pip install --no-cache-dir -r /opt/requirements-calendar.txt && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY tests ./tests
COPY prompts ./prompts
RUN npm run build
USER node
CMD ["node","dist/server.js"]
