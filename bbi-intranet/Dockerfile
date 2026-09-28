FROM node:22-bookworm-slim
WORKDIR /bbi
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 4321
ENV NODE_OPTIONS=--max-old-space-size=3072
CMD ["npm", "run", "start"]
