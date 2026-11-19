# Build context is the repo root (the frontend imports the shared package).
#   docker build -f frontend/Dockerfile -t telemetry-web .

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w frontend --no-audit --no-fund

FROM deps AS build
ARG VITE_USE_MOCK=false
ENV VITE_USE_MOCK=$VITE_USE_MOCK
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY frontend frontend
RUN npm run build -w frontend

# `docker compose --profile test run --rm web-test`
FROM build AS test
CMD ["npm", "test", "-w", "frontend"]

FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
