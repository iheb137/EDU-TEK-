# ---------- Étape 1 : compilation Angular ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# ---------- Étape 2 : service par nginx ----------
FROM nginxinc/nginx-unprivileged:1.28-alpine
USER root
RUN apk upgrade --no-cache          # correctifs de sécurité Alpine (OpenSSL...)
USER 101
ENV BACKEND_URL=http://backend:8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/edutek-front/browser /usr/share/nginx/html
EXPOSE 8080
