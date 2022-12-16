import { z } from "zod";

// const onlyPingMessageAllowed = z.object({
//   event: z.literal("ping"),
// });

export const clientMessages = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("ping"),
  }),
  z.object({
    event: z.literal("join"),
    room: z.string().min(1),
  }),
  z.object({
    event: z.literal("leave"),
    room: z.string().min(1),
  }),
  z.object({
    event: z.literal("getRandomNumber"),
    payload: z.object({
      from: z.number().min(1),
      to: z.number().min(1),
    }),
  }),
]);

export const serverMessages = z.union([
  z.object({
    event: z.literal("pong"),
  }),
  z.object({
    event: z.literal("joined"),
    room: z.string().min(1),
  }),
  z.object({
    event: z.literal("left"),
    room: z.string().min(1),
  }),
  z.object({
    event: z.literal("randomNumber"),
    value: z.number(),
  }),
]);
