/**
 * CLI Output Utility
 * Uses process.stdout/stderr directly to avoid console.* linting restrictions
 */

export function writeStdout(message: string): void {
    const line = message + '\n';
    if (!process.stdout.write(line)) {
        process.stdout.once('drain', () => {});
    }
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

export function writeMarkdown(content: string): void {
    writeStdout(content);
}

