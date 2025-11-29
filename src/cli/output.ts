/**
 * CLI Output Utility
 * Uses process.stdout/stderr directly to avoid console.* linting restrictions
 */

export function writeStdout(message: string): void {
    process.stdout.write(message + '\n');
}

export function writeStderr(message: string): void {
    process.stderr.write(message + '\n');
}

export function writeError(message: string): void {
    writeStderr(`Error: ${message}`);
}

export function writeJson(data: any): void {
    writeStdout(JSON.stringify(data, null, 2));
}

