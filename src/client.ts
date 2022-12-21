import EventEmitter from "eventemitter3";
import WebSocket from "isomorphic-ws";
import { z } from "zod";
import type {
  ClientOptions,
  DataFromDefaultEvents,
  DefaultEvents,
} from "./types";

export { ClientOptions, DataFromDefaultEvents, DefaultEvents };

export default function Client<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  M extends keyof z.infer<I>
>({
  matchEventsOn,
  incoming,
  outgoing,
  url,
  reconnectTimeout = 2_500,
  heartbeat,
  reconnect = true,
}: ClientOptions<I, O>) {
  let socket: WebSocket;
  let heartbeatIntervalId: ReturnType<typeof setInterval>;

  const events = new EventEmitter();
  const queue: { at: number; event?: string; data: unknown }[] = [];

  function connect() {
    socket = new WebSocket(url);

    socket.onopen = () => {
      events.emit("open", { at: Date.now() });

      if (heartbeat) {
        heartbeatIntervalId = setInterval(() => {
          socket.send(JSON.stringify(heartbeat.shape));
        }, heartbeat.interval);
      }
    };

    socket.onclose = (event) => {
      events.emit("close", {
        at: Date.now(),
        code: event.code,
        reason: event.reason,
      });

      heartbeatIntervalId && clearInterval(heartbeatIntervalId);

      if (!reconnect) {
        return;
      }

      if (typeof reconnect === "boolean") {
        setTimeout(connect, reconnectTimeout);
        return;
      }

      const shouldReconnect = reconnect(event);
      if (shouldReconnect) {
        setTimeout(connect, reconnectTimeout);
      }
    };

    socket.onmessage = (event) => {
      let json;

      try {
        json = JSON.parse(event.data.toString());
      } catch (error) {}

      try {
        const parsed = incoming.safeParse(json);

        if (parsed.success) {
          const data = parsed.data;

          queue.push(
            {
              at: Date.now(),
              event: data[matchEventsOn],
              data,
            },
            {
              at: Date.now(),
              event: "message",
              data,
            }
          );

          if (matchEventsOn) {
            events.emit(data[matchEventsOn], data);
          }

          events.emit("message", data);

          return;
        }

        throw new Error("InvalidPayload");
      } catch (error) {
        queue.push({
          at: Date.now(),
          event: "invalidPayload",
          data: event.data,
        });

        return events.emit("invalidPayload", {
          at: Date.now(),
          data: event.data,
          error,
        });
      }
    };
  }

  connect();

  return {
    send(data: z.infer<O>) {
      if (outgoing) {
        const parsed = outgoing.safeParse(data);

        if (parsed.success) {
          socket.send(JSON.stringify(parsed.data));
        } else {
          events.emit("invalidPayload", {
            at: Date.now(),
            data,
            error: parsed.error,
          });
        }

        return;
      }

      socket.send(JSON.stringify(data));
    },

    on<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvents<I, O, E>
      ) => void
    ) {
      events.on(event, handler);
    },

    once<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvents<I, O, E>
      ) => void
    ) {
      events.once(event, handler);
    },

    off<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvents<I, O, E>
      ) => void
    ) {
      events.off(event, handler);
    },
  };
}
