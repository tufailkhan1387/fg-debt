export interface AssistantBootstrapResult {
  matterId: string | null;
  greeting: string;
  suggestions: string[];
  capabilities: string[];
}

export interface AssistantChatResult {
  reply: string;
  suggestedFollowUps: string[];
}
