FROM nixos/nix:2.28.3@sha256:e623d73af9cac82d1b50784c83e0cf2a4b83bfd2cfe8d5b67809a2fc94e043ac AS builder

WORKDIR /src
COPY . .

RUN nix build \
  --extra-experimental-features "nix-command flakes" \
  --out-link /tmp/request-tracker-result \
  .#default \
  && mkdir -p /tmp/app \
  && ln -s "$(readlink -f /tmp/request-tracker-result)/bin/request-tracker-google-chat-integration" \
    /tmp/app/request-tracker-google-chat-integration \
  && nix-store --export $(nix-store -qR /tmp/request-tracker-result) > /tmp/nix-closure.nar

FROM nixos/nix:2.28.3@sha256:e623d73af9cac82d1b50784c83e0cf2a4b83bfd2cfe8d5b67809a2fc94e043ac

COPY --from=builder /tmp/nix-closure.nar /tmp/nix-closure.nar
RUN nix-store --import < /tmp/nix-closure.nar \
  && rm /tmp/nix-closure.nar

COPY --from=builder /tmp/app /usr/local/bin

ENV NODE_ENV=production \
    PORT=3000 \
    RT_CONNECT_DATA_DIR=/var/lib/request-tracker-google-chat

RUN mkdir -p /var/lib/request-tracker-google-chat \
  && chown 1000:100 /var/lib/request-tracker-google-chat
VOLUME ["/var/lib/request-tracker-google-chat"]
EXPOSE 3000

USER 1000:100
ENTRYPOINT ["/usr/local/bin/request-tracker-google-chat-integration"]
