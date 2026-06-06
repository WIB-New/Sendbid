# SENDBID + PAYBID Frontend — Expo Web static build derrière nginx
# Build : docker build --build-arg EXPO_PUBLIC_BACKEND_URL=https://api.sendfloo.sendbid.app -t sendbid-frontend ./frontend
# Run   : docker run -p 8080:80 sendbid-frontend

# ===== Stage 1 : build du bundle Expo Web =====
FROM node:20-alpine AS builder

# Yarn n'est pas dans node:20-alpine ; on l'installe globalement
RUN apk add --no-cache git python3 make g++ && npm install -g yarn@1.22.22

WORKDIR /app

# Cache layer : install des deps
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copie du code
COPY . .

# Variable d'env injectée à la build (l'URL backend prod)
ARG EXPO_PUBLIC_BACKEND_URL
ENV EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL}

# Build statique pour le web → dossier dist/
RUN npx expo export -p web

# ===== Stage 2 : serveur nginx ultra-léger =====
FROM nginx:1.27-alpine

# nginx.conf custom (SPA fallback + cache assets)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie du bundle Expo Web
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost/healthz > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
