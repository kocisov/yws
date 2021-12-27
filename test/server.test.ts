import { createTypedFunctions } from "../src/server";

test("creates functions and channels object", () => {
  const functions = createTypedFunctions();
  expect(functions).toMatchObject({
    channelsInMemory: {
      all: {},
    },
    wrap: expect.any(Function),
    broadcast: expect.any(Function),
    commitTo: expect.any(Function),
  });
});
