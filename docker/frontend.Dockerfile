FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/public/ public/
COPY frontend/src/ src/
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/frontend-entrypoint.sh /docker-entrypoint.d/40-vitalitynutri-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod +x /docker-entrypoint.d/40-vitalitynutri-config.sh

ENV BACKEND_UPSTREAM=http://backend:80
ENV FRONTEND_LANGUAGE=en
ENV FRONTEND_MAX_UPLOAD_SIZE_MB=15
ENV NGINX_CLIENT_MAX_BODY_SIZE=25M
EXPOSE 80