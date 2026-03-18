FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o ds-explorer ./cmd/server

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/ds-explorer .
COPY web/   web/
COPY content/ content/
EXPOSE 8080
CMD ["./ds-explorer"]
