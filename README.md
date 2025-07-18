# MongoDB Atlas Local Container Manager Extension

This Docker extension provides a comprehensive management interface for your MongoDB Atlas Local containers with advanced filtering, launching, and monitoring capabilities.

## Features

- **Container Listing**: View MongoDB Atlas Local containers with the label `mongodb-atlas-local=container`
- **Container Launching**: Launch new MongoDB Atlas Local containers with configuration options
- **Authentication Support**: Optional username/password configuration for new containers
- **Custom Port Assignment**: Specify custom ports or use auto-assignment
- **MongoDB Connection Strings**: Automatically generated connection strings with copy-to-clipboard functionality

## Prerequisites

- Docker Desktop installed and running
- Docker Extension API enabled

## Container Information Displayed

The extension shows the following information for each MongoDB Atlas Local container:

- **Container Name**: The name of the container (without the leading slash)
- **Status**: Current container status with color-coded chips
- **Image**: The Docker image used by the container
- **Connection String**: MongoDB connection string with copy-to-clipboard functionality
  - Format: `mongodb://localhost:<public_port>/test?directConnection=true`
  - With authentication: `mongodb://username:password@localhost:<public_port>/test?directConnection=true&authSource=admin`

## Installation

This extension helps you manage MongoDB Atlas Local containers by providing:
- Real-time container monitoring with auto-refresh
- Easy connection string generation and copying
- Container launching with authentication and port configuration
- Automatic filtering of MongoDB Atlas Local containers

### Quick Install

```shell
docker extension install fcmenezes87/mongodb_atlas_local_extension:latest
```

### Manual Build

To build the extension, use `make build-extension` **or**:

```shell
docker buildx build -t fcmenezes87/mongodb_atlas_local_extension:latest . --load
```

To install the extension, use `make install-extension` **or**:

```shell
docker extension install fcmenezes87/mongodb_atlas_local_extension:latest
```

> If you want to automate this command, use the `-f` or `--force` flag to accept the warning message.

## Usage

1. Open Docker Desktop
2. Navigate to the "Mongodb Atlas Local" tab in the left sidebar
3. The extension automatically displays MongoDB Atlas Local containers
4. Use the search field to filter containers by name or image
5. Click "Launch New Container" to create new MongoDB Atlas Local instances
6. Copy connection strings with the copy button for easy database access

### Container Filtering

The extension uses the Docker API filter equivalent to:
```bash
docker ps -f label=mongodb-atlas-local=container
```

This ensures you only see MongoDB Atlas Local containers that are part of your setup.

### Container Launching

Click "Launch New Container" to open the configuration dialog where you can:

- **Container Name**: Set an optional custom name (auto-generated if left empty)
- **Custom Port**: Specify a port number (1-65535) or leave empty for auto-assignment
- **Authentication**: Choose between authentication or no authentication
  - **Use Authentication**: Requires username and password
  - **Skip Authentication**: Runs without authentication (not recommended)
- **Launch**: Create the container with your configuration

The container will be automatically labeled with `mongodb-atlas-local=container` and appear in your container list.

## Development

This extension is composed of:

- A [frontend](./ui) app in React that displays MongoDB Atlas Local container information using the Docker Extension API

### Frontend Development

During development, you can use hot reloading:

```shell
cd ui
npm install
npm run dev
```

This starts a development server that listens on port `3000`.

You can now tell Docker Desktop to use this as the frontend source:

```shell
docker extension dev ui-source fcmenezes87/mongodb_atlas_local_extension:latest http://localhost:3000
```

To open Chrome Dev Tools for debugging:

```shell
docker extension dev debug fcmenezes87/mongodb_atlas_local_extension:latest
```



## API Usage

The extension uses the Docker Extension API client to interact with Docker Desktop:

```typescript
import { createDockerDesktopClient } from '@docker/extension-api-client';

const client = createDockerDesktopClient();
const containers = await client.docker.listContainers({ all: true });
```

## Troubleshooting

### No containers showing
- Ensure your MongoDB Atlas Local containers have the label `mongodb-atlas-local=container`
- Check that containers are running with `docker ps`
- Verify the extension is properly installed and enabled

### Connection string issues
- Verify the container has exposed ports
- Check that the container is running and healthy
- Ensure the container is accessible from your host machine

### Container launch failures
- Check that Docker has sufficient resources
- Verify the specified port is not already in use
- Ensure you have proper permissions to create containers

## Clean up

To remove the extension:

```shell
docker extension rm fcmenezes87/mongodb_atlas_local_extension:latest
```

## CI/CD with GitHub Actions

This repository includes a GitHub Actions workflow that automatically builds and pushes the Docker extension image when code is merged to the main branch.

### Setup Required Secrets

To enable automatic builds, you need to add the following secrets to your GitHub repository:

1. Go to your repository settings → Secrets and variables → Actions
2. Add these repository secrets:
   - `DOCKERHUB_USERNAME`: Your Docker Hub username
   - `DOCKERHUB_TOKEN`: Your Docker Hub access token (not your password)

### How to Create a Docker Hub Access Token

1. Log in to [Docker Hub](https://hub.docker.com/)
2. Go to Account Settings → Security
3. Click "New Access Token"
4. Give it a name (e.g., "GitHub Actions")
5. Copy the token and save it as the `DOCKERHUB_TOKEN` secret

### Workflow Behavior

- **On Pull Requests**: Builds the image but doesn't push (for testing)
- **On Main Branch Push**: Builds and pushes the image with appropriate tags
- **Multi-platform**: Builds for both `linux/amd64` and `linux/arm64`
- **Caching**: Uses GitHub Actions cache for faster builds

### Manual Build Commands

You can still build manually using the Makefile:

```shell
make build-extension    # Build the extension
make install-extension  # Install the extension
make push-extension     # Push to Docker Hub
```

## What's next?

- To learn more about how to build your extension refer to the Extension SDK docs at https://docs.docker.com/desktop/extensions-sdk/.
- To publish your extension in the Marketplace visit https://www.docker.com/products/extensions/submissions/.
- To report issues and feedback visit https://github.com/docker/extensions-sdk/issues.
- To look for other ideas of new extensions, or propose new ideas of extensions you would like to see, visit https://github.com/docker/extension-ideas/discussions.
