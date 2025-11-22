export interface EmbeddingResult {
    embedding: number[];
    model: string;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}

export interface BatchEmbeddingResult {
    embeddings: number[][];
    model: string;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}