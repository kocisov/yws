import { z } from "zod";

export const clientMessages = z.object({
  t: z.literal("ping"),
});

export const serverMessages = z.union([
  z.object({ t: z.literal("pong") }),
  z.object({ t: z.literal("test-out"), p: z.number() }),
]);

// const ClientMessages = z.discriminatedUnion("t", [
//   z.object({ t: z.literal("ping") }),
//   z.object({ t: z.literal("test-in"), p: z.string() }),
// ]);
