import React from 'react';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { 
  Stack, 
  TextField, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Button,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Refresh as RefreshIcon, ContentCopy as CopyIcon, PlayArrow as PlayIcon, Visibility, VisibilityOff } from '@mui/icons-material';

// Note: This line relies on Docker Desktop's presence as a host application.
// If you're running this React app in a browser, it won't work properly.
const client = createDockerDesktopClient();

function useDockerDesktopClient() {
  return client;
}

interface Container {
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

interface ContainerTableRow {
  id: string;
  name: string;
  status: string;
  image: string;
  connectionString?: string;
  isLoadingConnectionString?: boolean;
}

export function App() {
  const [containers, setContainers] = React.useState<ContainerTableRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filterCriteria, setFilterCriteria] = React.useState('');
  const [showLaunchDialog, setShowLaunchDialog] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const ddClient = useDockerDesktopClient();

  const generateMongoDBConnectionString = async (container: Container): Promise<string | undefined> => {
    // Check if container has exposed ports
    if (container.Ports && container.Ports.length > 0) {
      const port = container.Ports[0];
      if (port.PublicPort) {
        try {
          // Inspect the container to get environment variables using CLI
          const inspectResult = await ddClient.docker.cli.exec('inspect', [container.Id]);
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
  };

  const fetchContainers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const containersData = await ddClient.docker.listContainers({ 
        all: true,
        filters: JSON.stringify({
          label: ['mongodb-atlas-local=container']
        })
      }) as Container[];
      
      // First, create containers with loading state
      const initialContainers: ContainerTableRow[] = containersData.map((container: Container) => ({
        id: container.Id,
        name: container.Names[0]?.replace('/', '') || container.Id.substring(0, 12),
        status: container.Status,
        image: container.Image,
        isLoadingConnectionString: true
      }));
      
      setContainers(initialContainers);
      
      // Then, generate connection strings for each container
      const processedContainers: ContainerTableRow[] = await Promise.all(
        containersData.map(async (container: Container) => {
          const connectionString = await generateMongoDBConnectionString(container);
          
          return {
            id: container.Id,
            name: container.Names[0]?.replace('/', '') || container.Id.substring(0, 12),
            status: container.Status,
            image: container.Image,
            connectionString,
            isLoadingConnectionString: false
          };
        })
      );
      
      setContainers(processedContainers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch containers');
    } finally {
      setLoading(false);
    }
  };

  const filteredContainers = React.useMemo(() => {
    if (!filterCriteria.trim()) {
      return containers;
    }
    
    const criteria = filterCriteria.toLowerCase();
    return containers.filter(container => 
      container.name.toLowerCase().includes(criteria) ||
      container.image.toLowerCase().includes(criteria)
    );
  }, [containers, filterCriteria]);

  React.useEffect(() => {
    fetchContainers();
  }, []);

  const getStatusColor = (status: string) => {
    if (status.includes('Up')) return 'success';
    if (status.includes('Exited')) return 'error';
    if (status.includes('Created')) return 'warning';
    return 'default';
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleLaunchClick = () => {
    setShowLaunchDialog(true);
  };

  const handleLaunchContainer = async (skipAuth: boolean = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const runArgs = [
        '-d',
        '-P',
        '--label', 'mongodb-atlas-local=container'
      ];

      // Add environment variables if credentials are provided and not skipping auth
      if (!skipAuth) {
        if (username.trim()) {
          runArgs.push('-e', `MONGODB_INITDB_ROOT_USERNAME=${username.trim()}`);
        }
        if (password.trim()) {
          runArgs.push('-e', `MONGODB_INITDB_ROOT_PASSWORD=${password.trim()}`);
        }
      }

      runArgs.push('mongodb/mongodb-atlas-local');

      await ddClient.docker.cli.exec('run', runArgs);
      
      // Reset form and close dialog
      setUsername('');
      setPassword('');
      setShowLaunchDialog(false);
      
      // Refresh the container list after launching
      await fetchContainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch new container');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelLaunch = () => {
    setUsername('');
    setPassword('');
    setShowLaunchDialog(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        MongoDB Atlas Local Containers
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View and filter your MongoDB Atlas Local containers. 
        Only containers with the label "mongodb-atlas-local=container" are displayed.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Filter MongoDB Atlas Local containers"
          placeholder="Filter by container name or image..."
          value={filterCriteria}
          onChange={(e) => setFilterCriteria(e.target.value)}
          sx={{ flexGrow: 1 }}
          size="small"
        />
        <Button
          variant="contained"
          onClick={fetchContainers}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
        >
          Refresh
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleLaunchClick}
          disabled={loading}
          startIcon={<PlayIcon />}
        >
          Launch New Container
        </Button>
      </Stack>

      <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Container Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Image</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Connection String</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredContainers.length === 0 ? (
                              <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  {loading ? (
                    <CircularProgress />
                  ) : (
                    <Typography color="text.secondary">
                      {filterCriteria ? 'No MongoDB Atlas Local containers match your filter criteria.' : 'No MongoDB Atlas Local containers found.'}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredContainers.map((container) => (
                <TableRow key={container.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {container.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={container.status}
                      color={getStatusColor(container.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {container.image}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {container.isLoadingConnectionString ? (
                        <CircularProgress size={16} />
                      ) : (
                        <>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              display: 'inline-block',
                              flexGrow: 1,
                              color: (!container.connectionString) ? 'error.main' : null
                            }}
                          >
                            {container.connectionString || 'Warning: No port exported'}
                          </Typography>
                          {container.connectionString && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => container.connectionString && copyToClipboard(container.connectionString)}
                              sx={{ 
                                minWidth: 'auto',
                                px: 1,
                                py: 0.5,
                              }}
                            >
                              <CopyIcon sx={{ fontSize: '1rem' }} />
                            </Button>
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Showing {filteredContainers.length} of {containers.length} MongoDB Atlas Local containers
      </Typography>

      {/* Launch Container Dialog */}
      <Dialog open={showLaunchDialog} onClose={handleCancelLaunch} maxWidth="sm" fullWidth>
        <DialogTitle>Launch MongoDB Atlas Local Container</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure MongoDB credentials for the new container. Leave fields empty to use default settings.
          </Typography>
          <Stack spacing={3}>
            <TextField
              label="MongoDB Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Leave empty for no authentication"
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>MongoDB Password</InputLabel>
              <OutlinedInput
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty for no authentication"
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                }
                label="MongoDB Password"
              />
            </FormControl>

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLaunch} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleLaunchContainer(true)} 
            variant="outlined"
            color="warning"
            disabled={loading}
          >
            Skip Auth (Not Recommended)
          </Button>
          <Button 
            onClick={() => handleLaunchContainer(false)} 
            variant="contained" 
            color="success"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
          >
            Launch Container
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
