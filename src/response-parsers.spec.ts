import { it, expect } from "vitest";
import { parseErrorResponse } from "./response-parsers";

it("parse an error string", async () => {
  const message = "error message";
  const response = new Response(message, { status: 400 });
  const error = await parseErrorResponse(response);
  expect(error.message).toBe("error message");
});

it("parse no message", async () => {
  const response = new Response("", { status: 400 });
  const error = await parseErrorResponse(response);
  expect(error.message).toContain("400");
});

it("parse JSON", async () => {
  const message = "json error message";
  const response = new Response(
    JSON.stringify({
      message,
      something: "else",
    }),
    { status: 400 },
  );
  const error = await parseErrorResponse(response);
  expect(error.message).toBe(message);
});
