# Image de développement SPFx — Intranet BBI
# Usage : docker compose up --build   (voir README.md)
FROM node:22-bookworm-slim

WORKDIR /bbi

# Dépendances dans une couche cachée (rebuild rapide quand seul le code change)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Code source
COPY . .

EXPOSE 4321 35729
ENV NODE_OPTIONS=--max-old-space-size=3072

# Serveur de développement SPFx (workbench) — https sur le port 4321
CMD ["npm", "run", "start"]
