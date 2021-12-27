import { createClient } from "../src/client";

test("creates client", (done) => {
  const client = createClient({
    url: "wss://ws.bitstamp.net",
  });

  expect(client).toMatchObject({
    getRaw: expect.any(Function),
    commit: expect.any(Function),
    close: expect.any(Function),
    getBuffer: expect.any(Function),
    messagesCount: expect.any(Function),
  });

  expect(client.getBuffer()).toStrictEqual([]);

  expect(client.messagesCount()).toStrictEqual(0);

  client.close();

  client.getRaw().onclose = () => {
    done();
  };
});
