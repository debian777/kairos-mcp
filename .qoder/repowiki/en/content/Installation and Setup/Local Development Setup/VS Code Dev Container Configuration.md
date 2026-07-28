# VS Code Dev Container Configuration

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [CONTRIBUTING.md](file://CONTRIBUTING.md)
- [package.json](file://package.json)
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.ui.json](file://tsconfig.ui.json)
- [vite.config.ts](file://vite.config.ts)
- [Dockerfile.dev](file://Dockerfile.dev)
- [Dockerfile.stdio](file://Dockerfile.stdio)
</cite>

## Update Summary
**Changes Made**
- Removed all references to .devcontainer directory and dev container configurations
- Updated introduction to reflect simplified local development approach
- Replaced dev container sections with local development instructions
- Updated troubleshooting guide for common local development issues
- Removed architecture diagrams related to containerized development
- Added guidance for direct Node.js development environment setup

## Table of Contents
1. [Introduction](#introduction)
2. [Local Development Setup](#local-development-setup)
3. [Development Environment Requirements](#development-environment-requirements)
4. [Project Structure](#project-structure)
5. [TypeScript Compilation Settings](#typescript-compilation-settings)
6. [Development Dependencies and Scripts](#development-dependencies-and-scripts)
7. [Remote Debugging Setup](#remote-debugging-setup)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)
11. [Appendices](#appendices)

## Introduction
This document explains how to set up a local development environment for Kairos MCP development. The project has moved away from containerized development in favor of a simpler, more direct approach using your local machine's Node.js installation. This change provides faster iteration cycles, easier debugging, and reduced complexity while maintaining consistent development experiences across different machines through standardized toolchain versions.

The local development approach eliminates the overhead of container management while providing full access to your system resources for optimal performance during development and testing.

## Local Development Setup
Setting up the development environment is straightforward and requires only Node.js and npm:

### Prerequisites
- **Node.js**: Version specified in package.json engines field
- **npm**: Latest stable version compatible with your Node.js installation
- **Git**: For cloning the repository and managing dependencies

### Quick Start
```bash
# Clone the repository
git clone https://github.com/debian777/kairos-mcp.git
cd kairos-mcp

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Development Workflow
1. **Install dependencies**: `npm install` - installs all required packages
2. **Start development server**: `npm run dev` - starts the application with hot reload
3. **Run TypeScript compilation**: `npm run build` - compiles TypeScript to JavaScript
4. **Execute tests**: `npm test` - runs unit and integration tests
5. **Build production artifacts**: `npm run build:prod` - creates optimized production builds

**Section sources**
- [README.md](file://README.md)
- [CONTRIBUTING.md](file://CONTRIBUTING.md)
- [package.json](file://package.json)

## Development Environment Requirements
The project uses specific versions of development tools to ensure consistency across different machines and environments.

### Node.js Version Management
The project specifies Node.js requirements in package.json to maintain compatibility:
- Uses Node.js engines field to define minimum supported versions
- Compatible with both LTS and current Node.js releases within specified ranges
- Supports development on macOS, Linux, and Windows platforms

### Toolchain Consistency
- **TypeScript**: Configured for strict type checking and modern ECMAScript features
- **Vite**: Used for fast development server and optimized builds
- **Testing Framework**: Jest for unit tests and Puppeteer for UI testing
- **Linting**: ESLint with custom rules for code quality enforcement

**Section sources**
- [package.json](file://package.json)
- [tsconfig.json](file://tsconfig.json)
- [vite.config.ts](file://vite.config.ts)

## Project Structure
The project follows a modular architecture with clear separation between core functionality, HTTP APIs, and user interface components.

```mermaid
graph TB
subgraph "Core Application"
A["src/index.ts"] --> B["src/server.ts"]
B --> C["src/bootstrap.ts"]
C --> D["src/config.ts"]
end
subgraph "HTTP Layer"
E["src/http/"] --> F["API Routes"]
F --> G["Authentication"]
G --> H["MCP Handlers"]
end
subgraph "Services"
I["src/services/"] --> J["Memory Store"]
J --> K["Qdrant Integration"]
K --> L["Redis Cache"]
end
subgraph "User Interface"
M["src/ui/"] --> N["React Components"]
N --> O["Vite Build System"]
end
```

**Diagram sources**
- [src/index.ts](file://src/index.ts)
- [src/server.ts](file://src/server.ts)
- [src/bootstrap.ts](file://src/bootstrap.ts)
- [src/config.ts](file://src/config.ts)
- [src/http/](file://src/http/)
- [src/services/](file://src/services/)
- [src/ui/](file://src/ui/)

**Section sources**
- [src/index.ts](file://src/index.ts)
- [src/server.ts](file://src/server.ts)
- [src/bootstrap.ts](file://src/bootstrap.ts)
- [src/config.ts](file://src/config.ts)

## TypeScript Compilation Settings
TypeScript configuration defines the compilation target, module system, path aliases, and strictness flags used throughout the development process.

### Core TypeScript Configuration
- **Target**: ES2022 for modern JavaScript features
- **Module**: CommonJS for Node.js compatibility
- **Strict Mode**: Enabled for comprehensive type checking
- **Path Aliases**: Configured for clean imports across packages

### UI-Specific Configuration
- **Separate tsconfig.ui.json**: Tailored for frontend build pipeline
- **Vite Integration**: Optimized for React component development
- **Hot Module Replacement**: Enabled for rapid UI development

### Development Benefits
- **Incremental Builds**: Faster compilation during development
- **Type Safety**: Comprehensive error detection and auto-completion
- **Cross-Platform Compatibility**: Consistent behavior across operating systems

**Section sources**
- [tsconfig.json](file://tsconfig.json)
- [tsconfig.ui.json](file://tsconfig.ui.json)
- [vite.config.ts](file://vite.config.ts)

## Development Dependencies and Scripts
The project includes comprehensive development tooling for building, testing, and maintaining code quality.

### Key Development Dependencies
- **Build Tools**: Vite for fast development server and optimized builds
- **Testing**: Jest for unit tests, Puppeteer for UI testing
- **Code Quality**: ESLint, Prettier for consistent code formatting
- **Development Utilities**: TypeScript compiler, source maps for debugging

### Essential NPM Scripts
- `npm run dev`: Start development server with hot reload
- `npm run build`: Compile TypeScript and bundle assets
- `npm test`: Execute test suite with coverage reporting
- `npm run lint`: Check code quality and formatting
- `npm run typecheck`: Validate TypeScript types without compilation

### Custom Development Scripts
The project includes specialized scripts for various development tasks:
- Database initialization and seeding
- API endpoint testing
- Documentation generation
- Performance profiling

**Section sources**
- [package.json](file://package.json)

## Remote Debugging Setup
The project supports comprehensive debugging capabilities for both Node.js backend and browser-based UI components.

### Node.js Backend Debugging
- **VS Code Launch Configuration**: Pre-configured for attaching to running processes
- **Source Maps**: Enabled for accurate breakpoint mapping
- **Environment Variables**: Support for development-specific configurations

### Browser UI Debugging
- **Vite Dev Server**: Built-in debugging support for React components
- **React Developer Tools**: Recommended extension for component inspection
- **Network Tab**: Monitor API calls and WebSocket connections

### Debugging Best Practices
- Use conditional breakpoints for complex logic paths
- Leverage console logging with structured output
- Utilize Chrome DevTools for performance analysis
- Test debugging setup in clean environments regularly

**Section sources**
- [vite.config.ts](file://vite.config.ts)
- [package.json](file://package.json)

## Performance Considerations
Optimizing the local development environment for maximum productivity and responsiveness.

### File System Optimization
- **Native File Watching**: Leverages OS-native file system events
- **Selective Compilation**: Only compiles changed files during development
- **Memory Management**: Configured heap sizes for large projects

### Build Performance
- **Incremental Builds**: TypeScript incremental compilation reduces rebuild times
- **Parallel Processing**: Multi-threaded compilation and testing
- **Dependency Caching**: npm cache optimization for faster installations

### Development Server Optimization
- **Hot Module Replacement**: Instant updates without full page reloads
- **Lazy Loading**: On-demand loading of large modules
- **Compression**: Gzip compression for development assets

**Section sources**
- [vite.config.ts](file://vite.config.ts)
- [package.json](file://package.json)

## Troubleshooting Guide
Common issues and solutions for local development environment problems.

### Node.js and Dependency Issues
- **Version Conflicts**: Use nvm or similar tools to manage Node.js versions
- **Permission Errors**: Ensure proper file permissions for global packages
- **Cache Corruption**: Clear npm cache with `npm cache clean --force`

### TypeScript Compilation Problems
- **Type Errors**: Review strict mode settings and update type definitions
- **Slow Compilation**: Enable incremental builds and exclude unnecessary files
- **Import Resolution**: Verify path aliases and module resolution settings

### Development Server Issues
- **Port Conflicts**: Change default ports in configuration files
- **Memory Limitations**: Increase Node.js heap size for large applications
- **File Watch Failures**: Adjust inotify limits on Linux systems

### Testing Environment Problems
- **Database Connectivity**: Ensure test databases are properly initialized
- **Mock Configuration**: Verify test mocks and stubs are correctly configured
- **Test Isolation**: Clean up test data between test runs

### Performance Optimization
- **Large Projects**: Use selective compilation and dependency caching
- **Memory Usage**: Monitor and optimize memory consumption patterns
- **Build Times**: Analyze build bottlenecks and optimize accordingly

**Section sources**
- [package.json](file://package.json)
- [tsconfig.json](file://tsconfig.json)

## Conclusion
The simplified local development approach for Kairos MCP provides a streamlined, efficient development experience without the complexity of container orchestration. By leveraging your local machine's native capabilities and standardized toolchain versions, developers can focus on coding rather than environment management.

This approach offers faster iteration cycles, easier debugging, and better integration with your preferred development tools while maintaining consistency across team members through well-defined version requirements and comprehensive documentation.

The transition from containerized to local development represents a strategic decision to prioritize developer productivity and simplicity while ensuring reliable, reproducible development environments through standardized toolchain management.

## Appendices

### Migration from Containerized Development
For teams transitioning from the previous containerized setup:

#### Environment Parity
- **Node.js Versions**: Match container Node.js versions with local installations
- **System Dependencies**: Install equivalent system libraries locally
- **Environment Variables**: Replicate container environment variables in local configs

#### Development Workflow Changes
- **Direct Execution**: Run commands directly instead of through containers
- **Volume Mounting**: Use symbolic links or direct file access instead of mounted volumes
- **Service Composition**: Set up local services (databases, caches) independently

#### Benefits of Local Development
- **Faster Iteration**: Direct file system access improves hot reload performance
- **Simplified Debugging**: Native debugging tools work without container limitations
- **Resource Efficiency**: No container overhead reduces memory and CPU usage
- **Tool Integration**: Better integration with IDE features and extensions

### Advanced Development Scenarios
For complex development needs:

#### Microservices Architecture
- **Service Discovery**: Use local service mesh or manual service management
- **Configuration Management**: Centralized configuration for multiple services
- **Inter-service Communication**: Configure local networking for service communication

#### CI/CD Pipeline Integration
- **Local Testing**: Mirror CI/CD environment configurations locally
- **Automated Workflows**: Set up local automation scripts for repetitive tasks
- **Artifact Generation**: Reproduce build artifacts for testing and deployment

**Section sources**
- [README.md](file://README.md)
- [CONTRIBUTING.md](file://CONTRIBUTING.md)
- [package.json](file://package.json)