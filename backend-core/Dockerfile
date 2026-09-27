FROM golang:alpine AS builder

# Allow Go to automatically match and fetch needed toolchain version
ENV GOTOOLCHAIN=auto

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and build statically linked binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server

# Minimal production runtime image (scratch/alpine)
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/server .

# Default HTTP Port
EXPOSE 9090

# Run the live tracking and attribution engine
CMD ["./server"]
