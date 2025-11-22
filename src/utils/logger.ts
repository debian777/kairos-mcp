/**
 * Logging utility for KAIROS MCP
 *
 * Handles transport-specific logging rules:
 * - STDIO: Logs to stderr (stdout is reserved for MCP protocol)
 * - HTTP: Logs to stdout (normal console logging)
 * 
 * Format control:
 * - LOG_FORMAT=text (default): Human-readable text format
 * - LOG_FORMAT=json: Structured JSON format for log aggregation
 */

type TransportType = 'stdio' | 'http';
type LogFormat = 'text' | 'json';

class Logger {
    private transportType: TransportType;
    private logFormat: LogFormat;

    /**
     * Log debug messages (emits only when LOG_LEVEL=debug)
     */
    debug(message: string): void {
        if (process.env['LOG_LEVEL'] === 'debug') {
            this.output('debug', { message });
        }
    }

    constructor() {
        // Determine transport type from environment
        const transportEnv = process.env['TRANSPORT_TYPE'] || 'stdio';
        const httpEnabled = process.env['HTTP_ENABLED'] !== 'false';
        const stdioEnabled = process.env['STDIO_ENABLED'] !== 'false';

        // If HTTP is explicitly enabled or is the transport type, use HTTP logging
        if (httpEnabled && transportEnv === 'http') {
            this.transportType = 'http';
        } else if (stdioEnabled || transportEnv === 'stdio') {
            this.transportType = 'stdio';
        } else {
            this.transportType = 'stdio'; // Default to stdio for safety
        }

        // Determine log format from environment (default: text)
        this.logFormat = process.env['LOG_FORMAT'] === 'json' ? 'json' : 'text';
    }

    /**
     * Format and output log message based on format preference
     */
    private output(level: 'debug' | 'info' | 'warn' | 'error' | 'tool' | 'success', data: Record<string, any>): void {
        if (this.logFormat === 'json') {
            const jsonLog = JSON.stringify({
                timestamp: new Date().toISOString(),
                level,
                ...data
            });

            if (this.transportType === 'stdio') {
                process.stderr.write(jsonLog + '\n');
            } else {
                // Fallback logging disabled - logger should always be available
            }
        } else {
            // Text format with timestamp and level
            const timestamp = new Date().toISOString().substr(11, 8);
            const levelLabel = level.toUpperCase().padEnd(7); // Pad for alignment
            const message = data['message'] || JSON.stringify(data);

            if (this.transportType === 'stdio') {
                process.stderr.write(`[${timestamp}] [${levelLabel}] ${message}\n`);
            } else {
                // Fallback logging disabled - logger should always be available
            }
        }
    }

    /**
     * Format tool operations with concise, clean output
     */
    tool(toolName: string, operation: 'search' | 'store' | 'update' | 'delete' | 'retrieve' | 'upsert' | 'rate', details: string): void {
        if (this.logFormat === 'json') {
            this.output('tool', {
                tool: toolName,
                operation: operation.toUpperCase(),
                details
            });
        } else {
            const message = `[${toolName}] ${operation.toUpperCase()} ${details}`;
            this.output('tool', { message });
        }
    }

    /**
     * Log success status
     */
    success(operation: string, details: string): void {
        if (this.logFormat === 'json') {
            this.output('success', {
                operation,
                details
            });
        } else {
            const message = `[${operation}] ${details}`;
            this.output('success', { message });
        }
    }

    /**
     * Log error messages with full context
     */
    error(message: string, error?: Error | any): void {
        if (this.logFormat === 'json') {
            const errorData: Record<string, any> = { message };

            if (error) {
                errorData['error'] = error instanceof Error ? {
                    message: error.message,
                    stack: process.env['NODE_ENV'] === 'development' ? error.stack : undefined
                } : error;
            }

            this.output('error', errorData);
        } else {
            const errorMsg = error ?
                `${message} | ${error instanceof Error ? error.message : JSON.stringify(error)}` :
                message;

            this.output('error', { message: errorMsg });

            // Log stack trace in development
            if (error && process.env['NODE_ENV'] === 'development') {
                const timestamp = new Date().toISOString().substr(11, 8);
                const levelLabel = 'ERROR'.padEnd(7);
                process.stderr.write(`[${timestamp}] [${levelLabel}] Stack: ${error instanceof Error ? error.stack : ''}\n`);
            }
        }
    }

    /**
     * Log warning messages
     */
    warn(message: string): void {
        this.output('warn', { message });
    }

    /**
     * Log info messages
     */
    info(message: string): void {
        this.output('info', { message });
    }

    /**
     * Log MCP request timeout errors
     */
    requestTimeout(operation: string, timeoutMs: number): void {
        if (this.logFormat === 'json') {
            this.output('error', {
                message: 'Request timeout',
                operation,
                timeoutMs,
                note: 'Client did not receive response'
            });
        } else {
            this.error(`${operation} timed out after ${timeoutMs}ms - client did not receive response`);
        }
    }

    /**
     * Get the current transport type
     */
    getTransportType(): TransportType {
        return this.transportType;
    }

    /**
     * Get the current log format
     */
    getLogFormat(): LogFormat {
        return this.logFormat;
    }
}

// Export singleton instance
export const logger = new Logger();
