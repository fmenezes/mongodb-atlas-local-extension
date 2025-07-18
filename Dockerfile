FROM --platform=$BUILDPLATFORM node:24-alpine AS client-builder
WORKDIR /ui
# cache packages in layer
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci
# install
COPY ui /ui
RUN npm run build

FROM alpine
LABEL org.opencontainers.image.title="MongoDB Atlas Local" \
    org.opencontainers.image.description="Manage MongoDB Atlas Local containers with connection strings, authentication, and easy container launching" \
    org.opencontainers.image.vendor="MongoDB Inc." \
    com.docker.desktop.extension.api.version="0.4.2" \
    com.docker.extension.screenshots="/screenshots/main.png,/screenshots/launch-dialog.png" \
    com.docker.desktop.extension.icon="/mongodb.svg" \
    com.docker.extension.detailed-description="A comprehensive Docker extension for managing MongoDB Atlas Local containers. Features include automatic connection string generation with authentication support, container filtering, status monitoring, and one-click container launching with optional credential configuration." \
    com.docker.extension.publisher-url="https://github.com/fmenezes/mongodb-atlas-local-extension" \
    com.docker.extension.additional-urls="" \
    com.docker.extension.categories="" \
    com.docker.extension.changelog=""

COPY metadata.json .
COPY mongodb.svg .
COPY screenshots/ ./screenshots/
COPY --from=client-builder /ui/build ui
