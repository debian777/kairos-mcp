/**
 * Prompt Processing Service for KAIROS MCP
 * 
 * Extracts "What Next" sections from markdown content and transforms stored 
 * markdown into actionable workflows with step linking and navigation metadata.
 */

import { logger } from '../utils/logger.js';

export interface ParsedPrompt {
  fullDescription: string;
  codeSections: string[];
  whatNext: string[];
  structured: boolean;
  hasWorkflowSteps: boolean;
}

export interface WorkflowLink {
  from_step_uuid?: string;
  to_step_uuid?: string;
  step_number: number;
  step_type: 'rule' | 'snippet' | 'context' | 'pattern' | 'action';
  description: string;
  what_next: string[];
}

export interface PromptProcessingResult {
  parsedPrompt: ParsedPrompt;
  workflowLinks: WorkflowLink[];
  metadata: {
    hasWhatNext: boolean;
    stepCount: number;
    workflowComplexity: 'simple' | 'moderate' | 'complex';
    estimatedCompletion: string;
  };
}

export class PromptProcessor {
  private static readonly WHAT_NEXT_REGEX = /\*\*What Next\*\*:\s*([\s\S]*?)(?=\n\n|\n\*\*|\Z)/gi;
  private static readonly SECTION_HEADERS = [
    '## Implementation Pattern',
    '## Pattern Implementation',
    '## Usage',
    '#### Usage',
    '### Usage',
    '## Example',
    '#### Example',
    '### Example',
    '## Code',
    '#### Code',
    '### Code'
  ];

  /**
   * Process markdown content and extract actionable prompts
   */
  processMarkdownContent(content: string): PromptProcessingResult {
    try {
      logger.debug('prompt-processor: Processing markdown content for prompts');

      const parsedPrompt = this.parseMarkdownSections(content);
      const workflowLinks = this.extractWorkflowLinks(parsedPrompt);
      const metadata = this.generateMetadata(parsedPrompt, workflowLinks);

      logger.info(`prompt-processor: Processed content with ${workflowLinks.length} workflow links`);

      return {
        parsedPrompt,
        workflowLinks,
        metadata
      };
    } catch (error) {
      logger.error('prompt-processor: Failed to process content', error);
      throw new Error(`Prompt processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse markdown content into structured sections
   */
  private parseMarkdownSections(content: string): ParsedPrompt {
    // Extract code sections
    const codeSections = this.extractCodeSections(content);

    // Extract "What Next" sections  
    const whatNext = this.extractWhatNextSections(content);

    // Clean content by removing extracted sections for full description
    const fullDescription = this.generateFullDescription(content);

    return {
      fullDescription,
      codeSections,
      whatNext,
      structured: whatNext.length > 0 || codeSections.length > 0,
      hasWorkflowSteps: whatNext.length > 0
    };
  }

  /**
   * Extract "What Next" sections using regex pattern
   */
  private extractWhatNextSections(content: string): string[] {
    const whatNextSections: string[] = [];
    let match;

    // Create regex instance for this method to avoid static access issues
    const whatNextRegex = /\*\*What Next\*\*:\s*([\s\S]*?)(?=\n\n|\n\*\*|\Z)/gi;

    while ((match = whatNextRegex.exec(content)) !== null) {
      const section = match[1]?.trim();
      if (section) {
        // Split by lines and clean up
        const steps = section
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0)
          .map((line: string) => line.replace(/^\*?\s*[-•]\s*/, '')) // Remove bullet points
          .filter((line: string) => line.length > 0);

        whatNextSections.push(...steps);
      }
    }

    return whatNextSections;
  }

  /**
   * Extract code sections from markdown
   */
  private extractCodeSections(content: string): string[] {
    const codeSections: string[] = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const codeBlock = match[0];
      // Extract just the code content without the backticks
      const code = codeBlock.replace(/^```[\w]*\n?/, '').replace(/```$/, '').trim();
      if (code) {
        codeSections.push(code);
      }
    }

    return codeSections;
  }

  /**
   * Generate clean full description without extracted sections
   */
  private generateFullDescription(content: string): string {
    let fullDescription = content;

    // Remove "What Next" sections using regex
    const whatNextRegex = /\*\*What Next\*\*:\s*([\s\S]*?)(?=\n\n|\n\*\*|\Z)/gi;
    fullDescription = fullDescription.replace(whatNextRegex, '');

    // Remove code blocks
    fullDescription = fullDescription.replace(/```[\s\S]*?```/g, '');

    // Clean up extra whitespace
    fullDescription = fullDescription.replace(/\n\s*\n\s*\n/g, '\n\n');

    return fullDescription.trim();
  }

  /**
   * Extract workflow linking information from parsed content
   */
  private extractWorkflowLinks(parsedPrompt: ParsedPrompt): WorkflowLink[] {
    const links: WorkflowLink[] = [];

    // Create links for each "What Next" step
    parsedPrompt.whatNext.forEach((step, index) => {
      links.push({
        step_number: index + 1,
        step_type: this.inferStepType(parsedPrompt, step),
        description: step,
        what_next: this.extractSubSteps(step)
      });
    });

    return links;
  }

  /**
   * Infer step type from content context
   */
  private inferStepType(parsedPrompt: ParsedPrompt, step: string): 'rule' | 'snippet' | 'context' | 'pattern' | 'action' {
    const lowerStep = step.toLowerCase();

    // Rule indicators
    if (lowerStep.includes('always') || lowerStep.includes('must') || lowerStep.includes('should') || lowerStep.includes('never')) {
      return 'rule';
    }

    // Action indicators  
    if (lowerStep.includes('implement') || lowerStep.includes('create') || lowerStep.includes('add') || lowerStep.includes('use')) {
      return 'action';
    }

    // Pattern indicators
    if (lowerStep.includes('pattern') || lowerStep.includes('pattern') || lowerStep.includes('design')) {
      return 'pattern';
    }

    // Snippet indicators
    if (lowerStep.includes('function') || lowerStep.includes('class') || lowerStep.includes('method')) {
      return 'snippet';
    }

    // Default to action for actionable next steps
    return 'action';
  }

  /**
   * Extract sub-steps from a main step
   */
  private extractSubSteps(step: string): string[] {
    // Look for numbered or bulleted sub-steps
    const subStepRegex = /\d+\.\s+|[-•]\s+/g;
    const subSteps = step.split(subStepRegex).filter(s => s.trim().length > 0);

    return subSteps.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Generate metadata for the processed content
   */
  private generateMetadata(parsedPrompt: ParsedPrompt, workflowLinks: WorkflowLink[]) {
    const hasWhatNext = parsedPrompt.whatNext.length > 0;
    const stepCount = workflowLinks.length;

    // Determine workflow complexity
    let workflowComplexity: 'simple' | 'moderate' | 'complex';
    if (stepCount === 0) {
      workflowComplexity = 'simple';
    } else if (stepCount <= 3) {
      workflowComplexity = 'simple';
    } else if (stepCount <= 6) {
      workflowComplexity = 'moderate';
    } else {
      workflowComplexity = 'complex';
    }

    // Estimate completion time based on complexity
    const timeEstimates = {
      simple: '5-10 minutes',
      moderate: '15-30 minutes',
      complex: '30-60 minutes'
    };

    return {
      hasWhatNext,
      stepCount,
      workflowComplexity,
      estimatedCompletion: timeEstimates[workflowComplexity]
    };
  }

  /**
   * Process content for storage with enhanced metadata
   */
  processForStorage(content: string): {
    processedContent: string;
    metadata: any;
    workflowLinks: WorkflowLink[];
  } {
    const result = this.processMarkdownContent(content);

    return {
      processedContent: result.parsedPrompt.fullDescription,
      metadata: {
        what_next: result.parsedPrompt.whatNext,
        code_sections: result.parsedPrompt.codeSections,
        workflow_metadata: result.metadata
      },
      workflowLinks: result.workflowLinks
    };
  }

  /**
   * Generate executable prompt from stored content
   */
  generateExecutablePrompt(knowledgeItem: any): string {
    const parts: string[] = [];

    // Add main content
    parts.push(knowledgeItem.description_full);

    // Add code sections if available
    if (knowledgeItem.workflow_metadata?.code_sections?.length > 0) {
      parts.push('\n**Code Examples:**');
      knowledgeItem.workflow_metadata.code_sections.forEach((code: string, index: number) => {
        parts.push(`\nExample ${index + 1}:\n\`\`\`\n${code}\n\`\`\``);
      });
    }

    // Add "What Next" section
    if (knowledgeItem.workflow_metadata?.what_next?.length > 0) {
      parts.push('\n**What Next:**');
      knowledgeItem.workflow_metadata.what_next.forEach((step: string, index: number) => {
        parts.push(`${index + 1}. ${step}`);
      });
    }

    return parts.join('\n\n');
  }

  /**
   * Link workflow steps with navigation metadata
   */
  linkWorkflowSteps(steps: any[]): WorkflowLink[] {
    const links: WorkflowLink[] = [];

    for (let i = 0; i < steps.length; i++) {
      const currentStep = steps[i];
      const previousStep = i > 0 ? steps[i - 1] : null;
      const nextStep = i < steps.length - 1 ? steps[i + 1] : null;

      links.push({
        from_step_uuid: previousStep?.step_uuid,
        to_step_uuid: nextStep?.step_uuid,
        step_number: currentStep.protocol?.step || i + 1,
        step_type: currentStep.type,
        description: currentStep.description_short,
        what_next: currentStep.workflow_metadata?.what_next || []
      });
    }

    return links;
  }
}

export default PromptProcessor;
