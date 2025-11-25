# Test Protocol: Proof of Work in Step 2

This document has proof-of-work in the second H2 section.

## Step 1: Initial Setup
*   **MANDATE**: Configure the environment
*   **ACTION**: Run setup script
*   **VERIFY**: Check configuration files exist

## Step 2: Execute Process
*   **MANDATE**: Run the main process
*   **ACTION**: Execute command
*   **VERIFY**: Check output logs
*   Proof of work: `test -f cache/tests/execute.log`

## Step 3: Finalize
*   **MANDATE**: Clean up resources
*   **ACTION**: Remove temporary files
*   **VERIFY**: Confirm cleanup completed

**Expected behavior**: Step 2 should have proof-of-work, Steps 1 and 3 should not (may throw error if proofMode requires all sections except first).


