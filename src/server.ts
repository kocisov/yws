import { nanoid } from "nanoid";
import type { WebSocket } from "ws";

export type Out<Incoming, Outgoing> = {
  raw: WebSocket;
  id: string;
  onError(handler: (error: Error) => void): void;
  onClose(handler: (code: number, reason: string) => void): void;
  onMessage(handler: (data: Incoming) => void): void;
  join(channel: string): void;
  leave(channel: string): void;
  leaveAll(): void;
  commit(data: Outgoing | string): void;
};

export function createTypedFunctions<Incoming, Outgoing>() {
  const channelsInMemory: Record<string, Record<string, Out<Incoming, Outgoing>>> = {
    all: {},
  };

  return {
    channelsInMemory,
    wrap(raw: WebSocket) {
      const id = nanoid();
      const wrapped: Out<Incoming, Outgoing> = {
        raw,
        id,
        onError(handler) {
          raw.on("error", handler);
        },
        onClose(handler) {
          raw.on("close", (code, reason) => {
            handler(code, reason.toString("utf-8"));
          });
        },
        onMessage(handler) {
          raw.on("message", (message, isBinary) => {
            if (isBinary) {
              return;
            }
            try {
              const data = JSON.parse(message.toString());
              return handler(data);
            } catch {}
          });
        },
        join(channel) {
          if (!channelsInMemory[channel]) {
            channelsInMemory[channel] = {};
          }
          if (!channelsInMemory[channel][id]) {
            channelsInMemory[channel][id] = wrapped;
          }
        },
        leave(channel) {
          if (!channelsInMemory[channel][id]) {
            return;
          }
          if (Object.keys(channelsInMemory[channel]).length === 1) {
            delete channelsInMemory[channel];
            return;
          }
          delete channelsInMemory[channel][id];
        },
        leaveAll() {
          for (const channel of Object.keys(channelsInMemory)) {
            wrapped.leave(channel);
          }
        },
        commit(data) {
          if (raw.readyState === raw.OPEN) {
            raw.send(typeof data === "string" ? data : JSON.stringify(data));
          }
        },
      };
      wrapped.join("all");
      raw.on("close", wrapped.leaveAll);
      return wrapped;
    },
    broadcast(channelOrData: string | Outgoing, data?: Outgoing) {
      if (typeof data === "undefined") {
        for (const savedId in channelsInMemory.all) {
          channelsInMemory.all[savedId].commit(channelOrData);
        }
      }
      if (typeof channelOrData === "string" && typeof data !== "undefined") {
        for (const savedId in channelsInMemory[channelOrData]) {
          channelsInMemory[channelOrData][savedId].commit(data);
        }
      }
    },
    commitTo(id: string, data: Outgoing) {
      if (channelsInMemory.all[id]) {
        channelsInMemory.all[id].commit(data);
      }
    },
  };
}
