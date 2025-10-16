// fs-bridge.js - Expose MCP filesystem to window.fs for logger
// This allows the logger to save files directly to the codebase

// Note: This will only work when running in an environment with MCP access
// In browser without MCP, saveLogsToFile will fall back to download

if (typeof window !== 'undefined') {
  window.fs = {
    writeFile: async (path, content) => {
      // This is a placeholder - actual implementation would use MCP
      // For now, fall back to download
      throw new Error('MCP filesystem not available - falling back to download');
    },
    createDirectory: async (path) => {
      // This is a placeholder
      throw new Error('MCP filesystem not available');
    }
  };
}
