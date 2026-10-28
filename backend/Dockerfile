FROM node:26-slim@sha256:712b5d4c10e5262e60d8c027f7eb84065d3fa6a6e8fe9001d0d877bdb030b7f7 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build
# The runtime image has no npm, so dev dependencies are dropped here.
RUN npm prune --omit=dev

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:cb606325b7ec4af55462cb0b424a53b452a5b4a894ffe841fcf1048d216fb9f8
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["dist/index.js"]
