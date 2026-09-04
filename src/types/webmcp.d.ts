interface WebMcpToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: unknown) => unknown;
}

interface WebMcpModelContext {
  registerTool: (
    tool: WebMcpToolDefinition,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
}

declare global {
  interface Document {
    readonly modelContext?: WebMcpModelContext;
  }
}

export {};
