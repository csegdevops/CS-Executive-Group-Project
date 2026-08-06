export interface Summarizer {
  summarize(prompt: string): Promise<string>
}
