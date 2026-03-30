# Linting and Code Style

This project uses **Airbnb style guidelines** with ESLint and Prettier for consistent code formatting.

## Available Scripts

- `npm run lint` - Run ESLint to check for code issues
- `npm run lint:fix` - Automatically fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is properly formatted

## Code Style Rules

- **Single quotes** for strings
- **2 spaces** for indentation
- **Trailing commas** in multiline structures
- **Semicolons** required
- **Maximum line length**: 80 characters
- **Console statements**: Replaced with Winston logging
- **Unused variables**: Prefixed with underscore (`_`) when intentional

## Logging

This project uses **Winston** for structured logging with the following features:

### Log Levels
- `logInfo()` - General information messages
- `logWarn()` - Warning messages  
- `logError()` - Error messages with stack traces
- `logDebug()` - Debug messages (development only)

### Log Destinations
- **Console**: Colorized output for development
- **Files**: Daily rotating log files in `logs/` directory
  - `logs/application-YYYY-MM-DD.log` - All logs (info, warn, error)
  - `logs/error-YYYY-MM-DD.log` - Error logs only

### File Rotation
- **Frequency**: Daily rotation at midnight
- **Retention**: 
  - Application logs: 14 days
  - Error logs: 30 days
- **Max file size**: 20MB per file

### Usage Examples
```typescript
import { logInfo, logError, logWarn } from './lib/logger';

// Info logging with metadata
logInfo('User logged in', { userId: '123', ip: '192.168.1.1' });

// Error logging with exception
logError('Database connection failed', error);

// Warning logging
logWarn('Deprecated API endpoint used', { endpoint: '/old-api' });
```

## Configuration Files

- `eslint.config.mjs` - ESLint configuration with Airbnb rules
- `.prettierrc` - Prettier formatting configuration
- `app/lib/logger.ts` - Winston logging configuration

## VS Code Integration

For the best experience, install these VS Code extensions:
- ESLint
- Prettier - Code formatter

And add these settings to your `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```
