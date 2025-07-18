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
    org.opencontainers.image.vendor="Filipe C. Menezes" \
    com.docker.desktop.extension.api.version="0.4.2" \
    com.docker.extension.screenshots='[{"alt":"Main Screen", "url":"https://raw.githubusercontent.com/fmenezes/mongodb-atlas-local-extension/refs/heads/main/screenshots/main.png"},{"alt":"Launch Dialog", "url":"https://raw.githubusercontent.com/fmenezes/mongodb-atlas-local-extension/refs/heads/main/screenshots/launch-dialog.png"}]' \
    com.docker.desktop.extension.icon="https://raw.githubusercontent.com/fmenezes/mongodb-atlas-local-extension/refs/heads/main/mongodb.svg" \
    com.docker.extension.detailed-description="A comprehensive Docker extension for managing MongoDB Atlas Local containers. Features include automatic connection string generation with authentication support, container filtering, status monitoring, and one-click container launching with optional credential configuration." \
    com.docker.extension.publisher-url="https://github.com/fmenezes/mongodb-atlas-local-extension" \
    com.docker.extension.categories="database" \
    com.docker.extension.changelog="Initial release."

COPY metadata.json .
COPY mongodb.svg .
COPY screenshots/ ./screenshots/
COPY --from=client-builder /ui/build ui
