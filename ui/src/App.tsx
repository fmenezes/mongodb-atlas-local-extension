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
  IconButton,
  Snackbar,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { ContentCopy as CopyIcon, PlayArrow as PlayIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { ContainerService, ContainerTableRow, LaunchContainerOptions } from './lib';

export function App() {
  const ddClient = createDockerDesktopClient();
  const containerService = new ContainerService(ddClient);
  const [containers, setContainers] = React.useState<ContainerTableRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filterCriteria, setFilterCriteria] = React.useState('');
  const [showLaunchDialog, setShowLaunchDialog] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [containerName, setContainerName] = React.useState('');
  const [customPort, setCustomPort] = React.useState('');
  const [authChoice, setAuthChoice] = React.useState<'auth' | 'skip'>('auth');
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = React.useState<'success' | 'error'>('success');
  const [validationErrors, setValidationErrors] = React.useState<{
    username?: string;
    password?: string;
    port?: string;
  }>({});

  const fetchContainers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const containersData = await containerService.fetchContainers();
      setContainers(containersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch containers');
    } finally {
      setLoading(false);
    }
  };

  const filteredContainers = React.useMemo(() => {
    return containerService.filterContainers(containers, filterCriteria);
  }, [containers, filterCriteria]);

  React.useEffect(() => {
    fetchContainers();
    
    // Set up auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchContainers();
    }, 10000);
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await containerService.copyToClipboard(text);
      setToastSeverity('success');
      setToastMessage('Connection string copied to clipboard!');
    } catch (err) {
      setToastSeverity('error');
      setToastMessage(err instanceof Error ? err.message : 'Failed to copy connection string to clipboard');
    }
  };

  const handleLaunchClick = () => {
    setShowLaunchDialog(true);
  };

  const handleLaunchContainer = async () => {
    const options: LaunchContainerOptions = {
      containerName,
      customPort,
      authChoice,
      username,
      password
    };

    // Validate form before launching
    const errors = containerService.validateLaunchForm(options);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await containerService.launchContainer(options);
      
      // Reset form and close dialog
      setUsername('');
      setPassword('');
      setContainerName('');
      setCustomPort('');
      setAuthChoice('auth');
      setValidationErrors({});
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
    setContainerName('');
    setCustomPort('');
    setAuthChoice('auth');
    setValidationErrors({});
    setShowLaunchDialog(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        MongoDB Atlas Local Containers
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View and filter your MongoDB Atlas Local containers. 
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Filter MongoDB Atlas Local containers"
          placeholder="Filter by container name or version..."
          value={filterCriteria}
          onChange={(e) => setFilterCriteria(e.target.value)}
          sx={{ flexGrow: 1 }}
          size="small"
        />

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
              <TableCell sx={{ fontWeight: 'bold' }}>Version</TableCell>
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
                      color={containerService.getStatusColor(container.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {container.version}
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
                              onClick={() => copyToClipboard(container.connectionString!)}
                              sx={{ 
                                minWidth: 'auto',
                                px: 1,
                                py: 0.5,
                              }}
                            >
                              <CopyIcon />
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
              label="Container Name (Optional)"
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
              placeholder="Leave empty for auto-generated name"
              fullWidth
            />
            <TextField
              label="Custom Port (Optional)"
              value={customPort}
              onChange={(e) => setCustomPort(e.target.value)}
              placeholder="e.g., 27017 (leave empty for auto-assigned port)"
              fullWidth
              error={!!validationErrors.port}
              helperText={validationErrors.port || "MongoDB's default port is 27017"}
            />
            
            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>
                Authentication
              </Typography>
              <RadioGroup
                value={authChoice}
                onChange={(e) => setAuthChoice(e.target.value as 'auth' | 'skip')}
              >
                <FormControlLabel 
                  value="auth" 
                  control={<Radio />} 
                  label="Use Authentication (Recommended)" 
                />
                <FormControlLabel 
                  value="skip" 
                  control={<Radio />} 
                  label="Skip Authentication (Not Recommended)" 
                />
              </RadioGroup>
            </FormControl>

            {authChoice === 'auth' && (
              <>
                <TextField
                  label="MongoDB Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username for authentication"
                  fullWidth
                  required
                  error={!!validationErrors.username}
                  helperText={validationErrors.username}
                />
                <FormControl fullWidth error={!!validationErrors.password}>
                  <InputLabel>MongoDB Password *</InputLabel>
                  <OutlinedInput
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password for authentication"
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
                    label="MongoDB Password *"
                  />
                  {validationErrors.password && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {validationErrors.password}
                    </Typography>
                  )}
                </FormControl>
              </>
            )}

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLaunch} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleLaunchContainer} 
            variant="contained" 
            color="success"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
          >
            Launch Container
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={!!toastMessage}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setToastMessage(null)} 
          severity={toastSeverity}
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
