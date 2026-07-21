# SENDBID + PAYBID Frontend — Expo Web static build derrière nginx
# Build : docker build --build-arg EXPO_PUBLIC_BACKEND_URL=https://api.sendfloo.sendbid.app -t sendbid-frontend ./frontend
# Run   : docker run -p 8080:80 sendbid-frontend

# ===== Stage 1 : build du bundle Expo Web =====
FROM node:22-alpine AS builder

# Yarn est déjà inclus dans node:20-alpine. On n'installe que les outils natifs
# nécessaires aux wheels (sharp, jimp…) si jamais ils sont compilés depuis source.
RUN apk add --no-cache git python3 make g++

WORKDIR /app

# Cache layer : install des deps
COPY package.json yarn.lock* ./
RUN yarn install --no-frozen-lockfile --network-timeout 600000

# Copie du code
COPY . .

# === Variables d'env injectées à la build (audit 12/06/2026) ===
# Backend URL (obligatoire)
ARG EXPO_PUBLIC_BACKEND_URL=http://senfloosendbid-sendbidbackend-4qvjcs-734725-195-110-35-155.sslip.io
ENV EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL}

# Stripe publishable key (web checkout)
ARG EXPO_PUBLIC_STRIPE_PK=
ENV EXPO_PUBLIC_STRIPE_PK=${EXPO_PUBLIC_STRIPE_PK}

# Variante : sendbid (client) ou paybid (agent)
ARG EXPO_PUBLIC_APP_VARIANT=sendbid
ENV EXPO_PUBLIC_APP_VARIANT=${EXPO_PUBLIC_APP_VARIANT}

# Google Maps clés natives (injectées dans app.config.js pour iOS/Android builds)
ARG GOOGLE_MAPS_IOS_API_KEY
ENV GOOGLE_MAPS_IOS_API_KEY=${GOOGLE_MAPS_IOS_API_KEY}
ARG GOOGLE_MAPS_ANDROID_API_KEY
ENV GOOGLE_MAPS_ANDROID_API_KEY=${GOOGLE_MAPS_ANDROID_API_KEY}

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
