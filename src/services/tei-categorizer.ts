/**
 * TEI-Based Smart Domain/Task Auto-Detection for Store Tool
 *
 * Uses semantic similarity matching with Alibaba-NLP/gte-large-en-v1.5 embeddings
 * to automatically categorize workflows when domain/task are not provided.
 */

import { EmbeddingService } from './embedding/service.js';
import { logger } from '../utils/logger.js';

export interface CategoryDefinition {
    name: string;
    description: string;
    embedding?: number[];
}

export interface CategorizationResult {
    value: string;
    confidence: number;
}

export interface WorkflowCategorization {
    domain: CategorizationResult;
    task: CategorizationResult;
    tags: CategorizationResult[];
}

/**
 * Error thrown when auto-detection confidence is too low and user clarification is needed
 */
export class LowConfidenceError extends Error {
    constructor(
        message: string,
        public readonly detectedDomain?: CategorizationResult,
        public readonly detectedTask?: CategorizationResult,
        public readonly detectedTags?: CategorizationResult[]
    ) {
        super(message);
        this.name = 'LowConfidenceError';
    }
}

export class TEICategorizer {
    // Minimum confidence threshold for auto-detection (30%)
    // Below this threshold, user clarification is requested instead of using fallbacks
    private readonly MIN_CONFIDENCE_THRESHOLD = 0.3;

    private domains: CategoryDefinition[] = [
        { name: 'typescript', description: 'TypeScript, JavaScript, Node.js, React, Angular, Vue.js development' },
        { name: 'docker', description: 'Docker, containers, Kubernetes, container orchestration, deployment' },
        { name: 'ai', description: 'Artificial intelligence, machine learning, neural networks, LLMs, AI frameworks' },
        { name: 'python', description: 'Python programming, data science, web development, automation scripts' },
        { name: 'database', description: 'Database design, SQL, NoSQL, data modeling, migrations' },
        { name: 'security', description: 'Security practices, authentication, authorization, encryption, vulnerability assessment' },
        { name: 'testing', description: 'Unit testing, integration testing, test automation, QA processes' },
        { name: 'devops', description: 'CI/CD, infrastructure as code, monitoring, logging, deployment automation' },
        { name: 'api', description: 'REST APIs, GraphQL, API design, documentation, versioning' },
        { name: 'frontend', description: 'HTML, CSS, JavaScript, UI/UX, responsive design, web frameworks' },
        { name: 'backend', description: 'Server-side development, APIs, databases, business logic, scalability' },
        { name: 'mobile', description: 'Mobile app development, iOS, Android, cross-platform frameworks' },
        { name: 'cloud', description: 'AWS, Azure, GCP, cloud architecture, serverless computing' },
        { name: 'git', description: 'Version control, branching strategies, code reviews, collaboration' },
        { name: 'performance', description: 'Optimization, profiling, caching, scalability, monitoring' },
        { name: 'general', description: 'General purpose workflows, non-technical content, miscellaneous tasks' }
    ];

    private tasks: CategoryDefinition[] = [
        { name: 'feature-development', description: 'Implementing new features, adding functionality, building components' },
        { name: 'bug-fixing', description: 'Debugging, fixing errors, resolving issues, troubleshooting' },
        { name: 'refactoring', description: 'Code restructuring, improving maintainability, technical debt reduction' },
        { name: 'documentation', description: 'Writing docs, API documentation, code comments, user guides' },
        { name: 'setup-configuration', description: 'Project setup, configuration, environment setup, dependencies' },
        { name: 'testing-implementation', description: 'Writing tests, test automation, quality assurance' },
        { name: 'deployment', description: 'Building, packaging, deploying applications, release management' },
        { name: 'optimization', description: 'Performance tuning, memory optimization, speed improvements' },
        { name: 'security-hardening', description: 'Security fixes, vulnerability patches, secure coding practices' },
        { name: 'migration', description: 'Data migration, framework upgrades, system migrations' },
        { name: 'integration', description: 'Third-party integrations, API connections, system interoperability' },
        { name: 'maintenance', description: 'Code maintenance, dependency updates, system upkeep' },
        { name: 'research', description: 'Technology research, feasibility studies, proof of concepts' },
        { name: 'architecture-design', description: 'System design, architecture planning, technical specifications' },
        { name: 'code-review', description: 'Code review processes, quality gates, standards enforcement' },
        { name: 'general-task', description: 'General purpose tasks, miscellaneous activities, non-specific workflows' }
    ];

    private tags: CategoryDefinition[] = [
        // Technologies & Languages
        { name: 'typescript', description: 'TypeScript programming language, type safety, interfaces' },
        { name: 'javascript', description: 'JavaScript programming, ES6+, Node.js, browser development' },
        { name: 'python', description: 'Python programming, data science, automation, web development' },
        { name: 'react', description: 'React framework, components, hooks, state management' },
        { name: 'node.js', description: 'Node.js runtime, server-side JavaScript, npm packages' },
        { name: 'docker', description: 'Docker containers, images, Dockerfile, containerization' },
        { name: 'kubernetes', description: 'Kubernetes orchestration, pods, deployments, services' },

        // Frameworks & Libraries
        { name: 'express', description: 'Express.js web framework, routing, middleware, APIs' },
        { name: 'fastapi', description: 'FastAPI framework, async Python APIs, automatic documentation' },
        { name: 'next.js', description: 'Next.js React framework, SSR, static generation, routing' },
        { name: 'nestjs', description: 'NestJS Node.js framework, dependency injection, modules' },

        // Tools & Platforms
        { name: 'git', description: 'Git version control, branching, commits, pull requests' },
        { name: 'npm', description: 'npm package manager, dependencies, scripts, package.json' },
        { name: 'yarn', description: 'Yarn package manager, workspaces, dependencies' },
        { name: 'webpack', description: 'Webpack bundler, build tools, asset optimization' },
        { name: 'babel', description: 'Babel transpiler, JavaScript compilation, polyfills' },

        // Concepts & Practices
        { name: 'authentication', description: 'User authentication, login, JWT, OAuth, sessions' },
        { name: 'authorization', description: 'Access control, permissions, roles, RBAC' },
        { name: 'testing', description: 'Unit tests, integration tests, test frameworks, TDD' },
        { name: 'api', description: 'REST APIs, GraphQL, endpoints, HTTP methods, responses' },
        { name: 'database', description: 'Data storage, queries, schemas, migrations, ORM' },
        { name: 'security', description: 'Security practices, encryption, vulnerabilities, HTTPS' },
        { name: 'performance', description: 'Optimization, caching, monitoring, scalability' },
        { name: 'deployment', description: 'CI/CD, build pipelines, staging, production releases' },

        // Cloud & Infrastructure
        { name: 'aws', description: 'Amazon Web Services, EC2, S3, Lambda, cloud services' },
        { name: 'azure', description: 'Microsoft Azure cloud platform, services, deployment' },
        { name: 'gcp', description: 'Google Cloud Platform, services, deployment' },
        { name: 'vercel', description: 'Vercel platform, deployment, serverless functions' },
        { name: 'netlify', description: 'Netlify platform, static sites, serverless functions' },

        // Development Practices
        { name: 'ci-cd', description: 'Continuous integration, continuous deployment, pipelines' },
        { name: 'monitoring', description: 'Application monitoring, logging, alerts, observability' },
        { name: 'debugging', description: 'Debugging techniques, breakpoints, logging, error handling' },
        { name: 'refactoring', description: 'Code refactoring, improving code quality, maintainability' }
    ];

    constructor(private embeddingService: EmbeddingService) {
        // Pre-compute embeddings for all category descriptions at startup
        this.precomputeEmbeddings();
    }

    /**
     * Pre-compute embeddings for all category descriptions for performance
     */
    private async precomputeEmbeddings(): Promise<void> {
        try {
            // Batch embed all domain descriptions
            const domainDescriptions = this.domains.map(d => d.description);
            const domainBatchResult = await this.embeddingService.generateBatchEmbeddings(domainDescriptions);
            this.domains.forEach((domain, index) => {
                const embedding = domainBatchResult.embeddings[index];
                if (embedding) {
                    domain.embedding = embedding;
                }
            });

            // Batch embed all task descriptions
            const taskDescriptions = this.tasks.map(t => t.description);
            const taskBatchResult = await this.embeddingService.generateBatchEmbeddings(taskDescriptions);
            this.tasks.forEach((task, index) => {
                const embedding = taskBatchResult.embeddings[index];
                if (embedding) {
                    task.embedding = embedding;
                }
            });

            // Batch embed all tag descriptions
            const tagDescriptions = this.tags.map(t => t.description);
            const tagBatchResult = await this.embeddingService.generateBatchEmbeddings(tagDescriptions);
            this.tags.forEach((tag, index) => {
                const embedding = tagBatchResult.embeddings[index];
                if (embedding) {
                    tag.embedding = embedding;
                }
            });

            // Pre-computed embeddings loaded successfully
        } catch (error) {
            logger.warn(`⚠️ TEICategorizer: Failed to pre-compute embeddings: ${error instanceof Error ? error.message : String(error)}`);
            // Continue without pre-computed embeddings - will compute on-demand
        }
    }

    /**
     * Categorize a workflow based on title and steps using semantic similarity
     */
    async categorizeWorkflow(title: string, steps: string[]): Promise<WorkflowCategorization> {
        try {
            // Create workflow text representation by combining title and steps
            const workflowText = [
                title || '',
                ...steps.map((step, index) => `Step ${index + 1}: ${step}`)
            ].filter(text => text.trim().length > 0).join('\n');

            if (!workflowText.trim()) {
                throw new Error('No workflow content provided for categorization');
            }

            // Generate embedding for the workflow
            const workflowEmbedding = await this.embeddingService.generateEmbedding(workflowText);

            // Find best domain match
            const domainMatch = this.findBestMatch(workflowEmbedding.embedding, this.domains);

            // Find best task match
            const taskMatch = this.findBestMatch(workflowEmbedding.embedding, this.tasks);

            // Find relevant tags (multiple, high confidence only)
            const tagMatches = this.findRelevantTags(workflowEmbedding.embedding, this.tags);

            // Check confidence thresholds - request clarification if too low
            const lowConfidenceIssues: string[] = [];
            if (domainMatch.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
                lowConfidenceIssues.push(`domain (${domainMatch.value}: ${(domainMatch.confidence * 100).toFixed(1)}% confidence)`);
            }
            if (taskMatch.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
                lowConfidenceIssues.push(`task (${taskMatch.value}: ${(taskMatch.confidence * 100).toFixed(1)}% confidence)`);
            }

            if (lowConfidenceIssues.length > 0) {
                const issuesStr = lowConfidenceIssues.join(', ');
                throw new LowConfidenceError(
                    `Low confidence in auto-detection for: ${issuesStr}. Please provide explicit domain and/or task values. ` +
                    `Detected: domain="${domainMatch.value}", task="${taskMatch.value}". ` +
                    `Available domains: [${this.getAvailableDomains().join(', ')}]. ` +
                    `Available tasks: [${this.getAvailableTasks().join(', ')}].`,
                    domainMatch,
                    taskMatch,
                    tagMatches
                );
            }

            return {
                domain: domainMatch,
                task: taskMatch,
                tags: tagMatches
            };
        } catch (error) {
            // Graceful degradation - return fallback categories with low confidence
            logger.warn(`⚠️ TEICategorizer: Categorization failed, using fallbacks: ${error instanceof Error ? error.message : String(error)}`);
            return {
                domain: { value: 'general', confidence: 0.1 },
                task: { value: 'general-task', confidence: 0.1 },
                tags: []
            };
        }
    }

    /**
     * Find the best matching category using cosine similarity
     */
    private findBestMatch(workflowEmbedding: number[], categories: CategoryDefinition[]): CategorizationResult {
        let bestMatch: CategoryDefinition | null = null;
        let bestSimilarity = -1;

        for (const category of categories) {
            // Use pre-computed embedding if available, otherwise skip (shouldn't happen in normal operation)
            if (!category.embedding) {
                continue;
            }

            const similarity = this.embeddingService.calculateCosineSimilarity(workflowEmbedding, category.embedding);

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = category;
            }
        }

        if (!bestMatch) {
            // Fallback if no categories have embeddings
            return { value: 'unknown', confidence: 0.0 };
        }

        // Convert similarity to confidence score (cosine similarity ranges from -1 to 1, we want 0-1)
        const confidence = Math.max(0, Math.min(1, (bestSimilarity + 1) / 2));

        return {
            value: bestMatch.name,
            confidence: Math.round(confidence * 100) / 100 // Round to 2 decimal places
        };
    }

    /**
     * Find relevant tags using cosine similarity (returns multiple high-confidence matches)
     */
    private findRelevantTags(workflowEmbedding: number[], tags: CategoryDefinition[]): CategorizationResult[] {
        const tagMatches: Array<{ category: CategoryDefinition; similarity: number }> = [];

        for (const tag of tags) {
            // Use pre-computed embedding if available, otherwise skip
            if (!tag.embedding) {
                continue;
            }

            const similarity = this.embeddingService.calculateCosineSimilarity(workflowEmbedding, tag.embedding);
            tagMatches.push({ category: tag, similarity });
        }

        // Sort by similarity (highest first) and filter for high confidence
        const relevantTags = tagMatches
            .sort((a, b) => b.similarity - a.similarity)
            .filter(match => {
                const confidence = Math.max(0, Math.min(1, (match.similarity + 1) / 2));
                return confidence >= 0.8; // Only include tags with 80%+ confidence
            })
            .slice(0, 4) // Limit to top 4 most relevant tags
            .map(match => {
                const confidence = Math.max(0, Math.min(1, (match.similarity + 1) / 2));
                return {
                    value: match.category.name,
                    confidence: Math.round(confidence * 100) / 100
                };
            });

        return relevantTags;
    }

    /**
     * Get all available domains for reference
     */
    getAvailableDomains(): string[] {
        return this.domains.map(d => d.name);
    }

    /**
     * Get all available tasks for reference
     */
    getAvailableTasks(): string[] {
        return this.tasks.map(t => t.name);
    }

    /**
     * Get all available tags for reference
     */
    getAvailableTags(): string[] {
        return this.tags.map(t => t.name);
    }
}