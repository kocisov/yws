import type { z } from "zod";

export type DefaultEvents =
  | "open"
  | "close"
  | "error"
  | "message"
  | "invalidPayload";

export type DataFromDefaultEvent<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  E
> = E extends "open"
  ? { at: number }
  : E extends "close"
  ? { at: number; code: number; reason: string }
  : E extends "error"
  ? Error & { at: number }
  : E extends "invalidPayload"
  ? { at: number; data: any; type: "incoming" | "outgoing" }
  : E extends "message"
  ? z.infer<I> | z.infer<O>
  : never;

export type YwsServerWebSocket<O extends z.ZodTypeAny> = {
  publish(topic: string, data: any): boolean;
  close(code: number, reason: string): void;
  subscribe(topic: string): boolean;
  unsubscribe(topic: string): boolean;
  getSubscriptions(): string[];
  send(data: z.infer<O>): number;
};

export type ServerOptions<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = {
  matchEventsOn: keyof z.infer<I> | keyof z.infer<O>;
  incoming?: I;
  outgoing?: O;
  port?: number;
};

export type ClientOptions<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = {
  url: string;
  matchEventsOn: keyof z.infer<I> | keyof z.infer<O>;
  incoming?: I;
  outgoing?: O;
};
