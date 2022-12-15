import { z } from "zod";

// const onlyPingMessageAllowed = z.object({
//   t: z.literal("ping"),
// });

export const clientMessages = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("ping"),
  }),
  z.object({
    t: z.literal("join"),
    room: z.string().min(1),
  }),
  z.object({
    t: z.literal("leave"),
    room: z.string().min(1),
  }),
  z.object({
    t: z.literal("getRandomNumber"),
    p: z.object({
      from: z.number().min(1),
      to: z.number().min(1),
    }),
  }),
]);

export const serverMessages = z.union([
  z.object({
    t: z.literal("pong"),
  }),
  z.object({
    t: z.literal("joined"),
    room: z.string().min(1),
  }),
  z.object({
    t: z.literal("left"),
    room: z.string().min(1),
  }),
  z.object({
    t: z.literal("randomNumber"),
    p: z.number(),
  }),
]);
