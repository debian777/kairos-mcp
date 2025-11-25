# Test Protocol: Proof of Work in Step 1

This document has proof-of-work in the first H2 section.

## Step 1: Initial Setup
*   **MANDATE**: Configure the environment
*   **ACTION**: Run setup script
*   **VERIFY**: Check configuration files exist
*   Proof of work: `test -f cache/tests/setup.log`

## Step 2: Execute Process
*   **MANDATE**: Run the main process
*   **ACTION**: Execute command
*   **VERIFY**: Check output logs

## Step 3: Finalize
*   **MANDATE**: Clean up resources
*   **ACTION**: Remove temporary files
*   **VERIFY**: Confirm cleanup completed

**Expected behavior**: Step 1 should have proof-of-work, Steps 2 and 3 should not (may throw error if proofMode requires all sections).


