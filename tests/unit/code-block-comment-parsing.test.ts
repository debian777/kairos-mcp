import { parseMarkdownStructure } from '../../src/utils/memory-store-utils.js';
import { buildHeaderMemoryChain } from '../../src/services/memory/chain-builder.js';
import { CodeBlockProcessor } from '../../src/services/code-block-processor.js';

describe('Code Block Comment Parsing', () => {
  describe('parseMarkdownStructure', () => {
    test('should not interpret comments inside code blocks as H1 headers', () => {
      const markdown = `# Main Document

This is the main content.

\`\`\`hcl
module "my_document" {
  source = "path/to/module"
  
  name        = "My System"
  input_file  = "\${path.root}/content.yaml"
  output_file = "\${path.root}/output.md"
  
  # Select template type
  template_type = "operations_manual"
  
  # Optional: Custom title template
  title_template = "Operations Manual for {name}"
}
\`\`\`

## Section After Code Block

More content here.
`;

      const result = parseMarkdownStructure(markdown);
      
      // Should only find the actual H1 header, not the comments inside the code block
      expect(result.h1).toBe('Main Document');
      expect(result.h2Items).toEqual(['Section After Code Block']);
    });

    test('should not interpret comments inside code blocks as H2 headers', () => {
      const markdown = `# Main Document

\`\`\`bash
#!/bin/bash
# This is a comment
# Another comment
echo "Hello"
\`\`\`

## Real H2 Header

Content here.
`;

      const result = parseMarkdownStructure(markdown);
      
      expect(result.h1).toBe('Main Document');
      expect(result.h2Items).toEqual(['Real H2 Header']);
    });

    test('should handle nested code blocks correctly', () => {
      const markdown = `# Document

\`\`\`hcl
# Comment 1
resource "aws_instance" "example" {
  # Comment 2
  ami = "ami-123"
}
\`\`\`

## Section 1

\`\`\`python
# Python comment
def hello():
    pass
\`\`\`

## Section 2
`;

      const result = parseMarkdownStructure(markdown);
      
      expect(result.h1).toBe('Document');
      expect(result.h2Items).toEqual(['Section 1', 'Section 2']);
    });

    test('should handle code blocks with multiple comment lines', () => {
      const markdown = `# Main Title

\`\`\`terraform
# Provider configuration
provider "aws" {
  region = "us-east-1"
}

# Resource configuration
resource "aws_s3_bucket" "example" {
  bucket = "my-bucket"
}
\`\`\`

## Actual Section
`;

      const result = parseMarkdownStructure(markdown);
      
      expect(result.h1).toBe('Main Title');
      expect(result.h2Items).toEqual(['Actual Section']);
    });
  });

  describe('buildHeaderMemoryChain', () => {
    test('should not create separate chains from comments inside code blocks', () => {
      const markdown = `# First Chain

Content for first chain.

\`\`\`hcl
module "example" {
  # This comment should not create a new chain
  source = "path/to/module"
}
\`\`\`

## Step 1

More content.
`;

      const codeBlockProcessor = new CodeBlockProcessor();
      const now = new Date();
      const result = buildHeaderMemoryChain(markdown, 'test-model', now, codeBlockProcessor);
      
      // Should only create one chain (from the actual H1), not from the comment in the code block
      expect(result.length).toBeGreaterThan(0);
      
      // All memories should belong to the same chain
      const chainLabels = new Set(result.map(m => m.chain?.label).filter(Boolean));
      expect(chainLabels.size).toBe(1);
      expect(chainLabels.has('First Chain')).toBe(true);
    });

    test('should handle HCL code block with multiple comments', () => {
      const markdown = `# Terraform Configuration

\`\`\`hcl
module "my_document" {
  source = "path/to/module"

  name        = "My System"
  input_file  = "\${path.root}/content.yaml"
  output_file = "\${path.root}/output.md"

  confluence_space  = "MYSPACE"
  confluence_parent = "Parent/Page"

  # Select template type
  template_type = "operations_manual"  # or "it_contingency_plan"

  # Optional: Custom title template
  title_template = "Operations Manual for {name}"
}
\`\`\`

## Configuration Details
`;

      const codeBlockProcessor = new CodeBlockProcessor();
      const now = new Date();
      const result = buildHeaderMemoryChain(markdown, 'test-model', now, codeBlockProcessor);
      
      // Should create only one chain from the actual H1
      const chainLabels = new Set(result.map(m => m.chain?.label).filter(Boolean));
      expect(chainLabels.size).toBe(1);
      expect(chainLabels.has('Terraform Configuration')).toBe(true);
      
      // Verify the code block content is preserved in the memory text
      const memoryText = result[0]?.text || '';
      expect(memoryText).toContain('# Select template type');
      expect(memoryText).toContain('# Optional: Custom title template');
    });
  });
});

