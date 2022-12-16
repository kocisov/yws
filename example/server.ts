import { randomInt } from "node:crypto";
import Server from "../dist/server";
import { clientMessages, serverMessages } from "./messages";

const server = Server({
  matchEventsOn: "event",
  incoming: clientMessages,
  outgoing: serverMessages,
  // port: Number(process.env.PORT ?? 3420),
});

server.on("open", (socket) => {
  console.log(socket.getSubscriptions());

  socket.subscribe("messageEvery100ms");

  console.log(socket.getSubscriptions());
});

server.on("join", (socket, data) => {
  socket.subscribe(data.room);
});

server.on("getRandomNumber", (socket, data) => {
  const { from, to } = data.payload;
  const randomNumber = randomInt(from, to);
  socket.send({ event: "randomNumber", value: randomNumber });
});

let pings = 0;
server.on("ping", (socket, data) => {
  pings++;
  socket.send({ event: "pong" });
});

server.on("invalidPayload", (socket, payload) => {
  console.log("Invalid Payload", payload);
});

server.on("error", (socket, error) => {
  console.log(error);
});

setInterval(() => {
  server.publish("randomNumberEvery100ms", {
    event: "randomNumber",
    value: randomInt(-1337, 1337),
  });
}, 100);
