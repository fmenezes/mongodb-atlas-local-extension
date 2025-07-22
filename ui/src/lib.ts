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

export interface ListContainersResponseRow {
  id: string;
  name: string;
  status: string;
  version: string;
  connectionString?: string;
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
   * Fetch all MongoDB Atlas Local containers with their details
   */
  async fetchContainers(): Promise<ListContainersResponseRow[] | undefined> {
    return await this.ddClient.extension.vm?.service?.get('/containers') as ListContainersResponseRow[];
  }

  /**
   * Launch a new MongoDB Atlas Local container
   */
  async launchContainer(options: LaunchContainerOptions): Promise<void> {
    await this.ddClient.extension.vm?.service?.post('/containers', {
      name: options.containerName?.trim(),
      port: options.customPort?.trim(),
      username: options.username?.trim(),
      password: options.password?.trim(),
    });
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
  filterContainers(containers: ListContainersResponseRow[], criteria: string): ListContainersResponseRow[] {
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


