import { createDockerDesktopClient } from '@docker/extension-api-client';

export interface Container {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: Array<{
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }>;
  Labels: Record<string, string>;
  NetworkSettings: {
    Networks: Record<string, {
      IPAddress: string;
      Gateway: string;
    }>;
  };
}

export interface ContainerTableRow {
  id: string;
  name: string;
  status: string;
  version: string;
  connectionString?: string;
  isLoadingConnectionString?: boolean;
}

export interface LaunchContainerOptions {
  containerName?: string;
  customPort?: string;
  authChoice: 'auth' | 'skip';
  username?: string;
  password?: string;
}

export class ContainerService {

  constructor(private ddClient: ReturnType<typeof createDockerDesktopClient>) {}

  /**
   * Extract version information from container image labels
   */
  async extractVersionFromImage(container: Container): Promise<string> {
    try {
      // Inspect the container to get image information
      const inspectResult = await this.ddClient.docker.cli.exec('inspect', [container.Id]);
      const containerData = JSON.parse(inspectResult.stdout);
      const imageLabels = containerData[0]?.Config?.Labels || {};
      
      const version = imageLabels['version'] || 'Unknown';
      
      return version;
    } catch (err) {
      console.error('Failed to extract version from image:', err);
      return 'Unknown';
    }
  }

  /**
   * Generate MongoDB connection string for a container
   */
  async generateMongoDBConnectionString(container: Container): Promise<string | undefined> {
    // Check if container has exposed ports
    if (container.Ports && container.Ports.length > 0) {
      const port = container.Ports[0];
      if (port.PublicPort) {
        try {
          // Inspect the container to get environment variables using CLI
          const inspectResult = await this.ddClient.docker.cli.exec('inspect', [container.Id]);
          const containerData = JSON.parse(inspectResult.stdout);
          const envVars = containerData[0]?.Config?.Env || [];
          
          // Extract username, password, and database from environment variables
          let username = '';
          let password = '';
          let database = 'test'; // default database name
          
          for (const envVar of envVars) {
            if (envVar.startsWith('MONGODB_INITDB_ROOT_USERNAME=')) {
              username = envVar.split('=')[1];
            } else if (envVar.startsWith('MONGODB_INITDB_ROOT_PASSWORD=')) {
              password = envVar.split('=')[1];
            } else if (envVar.startsWith('MONGODB_INITDB_DATABASE=')) {
              database = envVar.split('=')[1];
            }
          }
          
          // Build connection string with authentication if credentials are available
          if (username && password) {
            return `mongodb://${username}:${password}@localhost:${port.PublicPort}/${database}?directConnection=true&authSource=admin`;
          } else {
            return `mongodb://localhost:${port.PublicPort}/${database}?directConnection=true`;
          }
        } catch (err) {
          console.error('Failed to inspect container:', err);
          // Fallback to connection string without authentication
          return `mongodb://localhost:${port.PublicPort}/test?directConnection=true`;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Fetch all MongoDB Atlas Local containers with their details
   */
  async fetchContainers(): Promise<ContainerTableRow[]> {
    try {
      const containersData = await this.ddClient.docker.listContainers({ 
        all: true,
        filters: JSON.stringify({
          label: ['mongodb-atlas-local=container']
        })
      }) as Container[];
      
      // Process containers to get version and connection string information
      const processedContainers: ContainerTableRow[] = await Promise.all(
        containersData.map(async (container: Container) => {
          const [version, connectionString] = await Promise.all([
            this.extractVersionFromImage(container),
            this.generateMongoDBConnectionString(container)
          ]);
          
          return {
            id: container.Id,
            name: container.Names[0]?.replace('/', '') || container.Id.substring(0, 12),
            status: container.Status,
            version,
            connectionString,
            isLoadingConnectionString: false
          };
        })
      );
      
      return processedContainers;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch containers');
    }
  }

  /**
   * Launch a new MongoDB Atlas Local container
   */
  async launchContainer(options: LaunchContainerOptions): Promise<void> {
    const runArgs = ['-d'];

    // Add container name if provided
    if (options.containerName?.trim()) {
      runArgs.push('--name', options.containerName.trim());
    }

    // Add port configuration
    if (options.customPort?.trim()) {
      // Use custom port mapping
      runArgs.push('-p', `${options.customPort.trim()}:27017`);
    } else {
      // Use default -P (publish all ports)
      runArgs.push('-P');
    }

    // Add environment variables if authentication is chosen and credentials are provided
    if (options.authChoice === 'auth') {
      if (options.username?.trim()) {
        runArgs.push('-e', `MONGODB_INITDB_ROOT_USERNAME=${options.username.trim()}`);
      }
      if (options.password?.trim()) {
        runArgs.push('-e', `MONGODB_INITDB_ROOT_PASSWORD=${options.password.trim()}`);
      }
    }

    runArgs.push('mongodb/mongodb-atlas-local');

    await this.ddClient.docker.cli.exec('run', runArgs);
  }

  /**
   * Validate launch container form data
   */
  validateLaunchForm(options: LaunchContainerOptions): { [key: string]: string } {
    const errors: { [key: string]: string } = {};

    // Validate authentication fields
    if (options.authChoice === 'auth') {
      if (!options.username?.trim()) {
        errors.username = 'Username is required when authentication is enabled';
      }
      if (!options.password?.trim()) {
        errors.password = 'Password is required when authentication is enabled';
      }
    }

    // Validate port
    if (options.customPort?.trim()) {
      const portNum = parseInt(options.customPort.trim());
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        errors.port = 'Port must be a number between 1 and 65535';
      }
    }

    return errors;
  }

  /**
   * Filter containers by name or version
   */
  filterContainers(containers: ContainerTableRow[], criteria: string): ContainerTableRow[] {
    if (!criteria.trim()) {
      return containers;
    }
    
    const searchCriteria = criteria.toLowerCase();
    return containers.filter(container => 
      container.name.toLowerCase().includes(searchCriteria) ||
      container.version.toLowerCase().includes(searchCriteria)
    );
  }

  /**
   * Get status color for status chip
   */
  getStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
    if (status.includes('Up')) return 'success';
    if (status.includes('Exited')) return 'error';
    if (status.includes('Created')) return 'warning';
    return 'default';
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      throw new Error('Failed to copy connection string to clipboard');
    }
  }
}


