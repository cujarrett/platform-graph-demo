FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV SCHEMA_PATH=/schema.graphql
ENV PORT=8080
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY schema.graphql /schema.graphql
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
