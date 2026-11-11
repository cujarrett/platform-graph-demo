FROM --platform=$BUILDPLATFORM golang:1.27-alpine@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS builder
ARG TARGETOS
ARG TARGETARCH
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o backend .

FROM ghcr.io/cujarrett/base-go:static-debian13@sha256:d1f5d2a974de81dffc620668df57baf021f1dab8d8b90968428dd00d20a3a090
COPY --from=builder /app/backend /backend
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/backend"]
