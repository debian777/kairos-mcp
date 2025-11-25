# Test Protocol: Proof of Work at End

This document has H2 sections with proof-of-work only at the very end.

## Step 1: Initial Setup
*   **MANDATE**: Configure the environment
*   **ACTION**: Run setup script
*   **VERIFY**: Check configuration files exist

## Step 2: Execute Process
*   **MANDATE**: Run the main process
*   **ACTION**: Execute command
*   **VERIFY**: Check output logs

## Step 3: Finalize
*   **MANDATE**: Clean up resources
*   **ACTION**: Remove temporary files
*   **VERIFY**: Confirm cleanup completed

*   Proof of work: `test -f cache/tests/finalize.log`

**Expected behavior**: Proof-of-work at end should apply to the last section (Step 3).


