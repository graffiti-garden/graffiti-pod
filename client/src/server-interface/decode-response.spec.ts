import { it, expect, assert } from "vitest";
import {
  catchResponseErrors,
  parseEncodedStringArrayHeader,
  parseGraffitiObjectResponse,
  parseJSONLinesResponse,
} from "./decode-response";
// import { randomLocation, randomString, randomValue } from "./test-utils";

// it("parse an error string", async () => {
//   const message = "error message";
//   const response = new Response(message, { status: 400 });
//   await expect(catchResponseErrors(response)).rejects.toMatchObject({
//     message: "error message",
//   });
// });

// it("parse error without message", async () => {
//   const response = new Response("", { status: 400 });
//   const error = await parseErrorResponse(response);
//   expect(error.message).toContain("400");
// });

// it("parse JSON error", async () => {
//   const message = "json error message";
//   const response = new Response(
//     JSON.stringify({
//       message,
//       something: "else",
//     }),
//     { status: 400 },
//   );
//   const error = await parseErrorResponse(response);
//   expect(error.message).toBe(message);
// });

// it("parse null header", async () => {
//   const result = parseEncodedStringArrayHeader(null, "default");
//   expect(result).toBe("default");
// });

// it("parse empty header", async () => {
//   const result = parseEncodedStringArrayHeader("", "default");
//   expect(result).toEqual([]);
// });

// it("encoded header", async () => {
//   const values = ["🪿", "//++  \n👻"];
//   const encoded = values.map(encodeURIComponent).join(",");
//   const result = parseEncodedStringArrayHeader(encoded, "default");
//   expect(result).toEqual(values);
// });

// it("parse put response", async () => {
//   const response = new Response("", {
//     status: 201,
//   });
//   const location = randomLocation(randomString(), randomString());
//   const parsed = await parseGraffitiObjectResponse(response, location, false);
//   expect(parsed.tombstone).toBe(true);
//   expect(parsed.value).toEqual({});
//   expect(parsed.channels).toEqual([]);
//   // expect(parsed.lastModified.getTime()).toBeNaN();
//   expect(parsed).toMatchObject(location);
// });

// it("parse non-get response", async () => {
//   const value = { value: "hello" };
//   const lastModified = new Date();
//   const channels = ["channel1", "channel2"];
//   const allowed = ["user1", "user2"];
//   const response = new Response(JSON.stringify(value), {
//     status: 200,
//     headers: {
//       "Last-Modified": lastModified.toISOString(),
//       Channels: channels.join(","),
//       Allowed: allowed.join(","),
//     },
//   });
//   const location = randomLocation(randomString(), randomString());
//   const parsed = await parseGraffitiObjectResponse(response, location, false);
//   expect(parsed.tombstone).toBe(true);
//   expect(parsed.value).toEqual(value);
//   expect(parsed.channels).toEqual(channels);
//   expect(parsed.allowed).toEqual(allowed);
//   // expect(parsed.lastModified.getTime()).toBe(lastModified.getTime());
//   expect(parsed).toMatchObject(location);
// });

// it("parse get response", async () => {
//   const value = { value: "hello" };
//   const lastModified = new Date();
//   const channels = ["channel1", "channel2"];
//   const allowed = ["user1", "user2"];
//   const response = new Response(JSON.stringify(value), {
//     status: 200,
//     headers: {
//       "Last-Modified": lastModified.toISOString(),
//       Channels: channels.join(","),
//       Allowed: allowed.join(","),
//     },
//   });
//   const location = randomLocation(randomString(), randomString());
//   const parsed = await parseGraffitiObjectResponse(response, location, true);
//   expect(parsed.tombstone).toBe(false);
//   expect(parsed.value).toEqual(value);
//   expect(parsed.channels).toEqual(channels);
//   expect(parsed.allowed).toEqual(allowed);
//   // expect(parsed.lastModified.getTime()).toBe(lastModified.getTime());
//   expect(parsed).toMatchObject(location);
// });

// it("parse no channels or allowed or value or timestamp", async () => {
//   const response = new Response("", {
//     status: 200,
//   });
//   const location = randomLocation(randomString(), randomString());
//   const parsed = await parseGraffitiObjectResponse(response, location, true);
//   expect(parsed.tombstone).toBe(false);
//   expect(parsed.value).toEqual({});
//   expect(parsed.channels).toEqual([]);
//   expect(parsed.allowed).toEqual(undefined);
//   // expect(parsed.lastModified.getTime()).toBeNaN();
//   expect(parsed).toMatchObject(location);
// });

// it("parse response with extra fields in location", async () => {
//   const value = randomValue();
//   const response = new Response(JSON.stringify(value), {
//     status: 200,
//   });
//   const location = {
//     ...randomLocation(randomString(), randomString()),
//     value: { not: "what you expect" },
//     some: "extra fields",
//   };

//   const parsed = await parseGraffitiObjectResponse(response, location, true);
//   expect(parsed.tombstone).toBe(false);
//   expect(parsed.value).toEqual(value);
//   expect(parsed).not.toHaveProperty("some");
// });

// it("parse response with error", async () => {
//   const response = new Response("error message", {
//     status: 400,
//   });
//   // const location = randomLocation(randomString(), randomString());
//   const parsing = parseGraffitiObjectResponse(response, location, true);
//   await expect(parsing).rejects.toMatchObject({
//     message: "error message",
//   });
// });

it("parse basic JSON lines", async () => {
  const values = [{ value: "hello" }, { value: "world" }];
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 200,
    },
  );
  const parsed = parseJSONLinesResponse(response, "", (o) => o);
  const first = await parsed.next();
  assert(!first.done && !first.value.error);
  expect(first.value.value).toEqual(values[0]);
  const second = await parsed.next();
  assert(!second.done && !second.value.error);
  expect(second.value.value).toEqual(values[1]);
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse erroneous JSON lines", async () => {
  const values = ["{}", "{", "{}"];
  const response = new Response(values.join("\n"), {
    status: 200,
  });
  const parsed = parseJSONLinesResponse(response, "", (o) => o);
  const first = await parsed.next();
  assert(!first.done && !first.value.error);
  const second = await parsed.next();
  assert(!second.done && second.value.error);
  const third = await parsed.next();
  assert(!third.done && !third.value.error);
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse json list with newlines", async () => {
  const values = [
    {
      "onevalue\n😭": "with hard 🤡🙈 to par\nse+ json",
    },
    {
      "another\nvalue": "wit\\h\\\n\n\n\\newlines",
    },
  ];
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 200,
    },
  );
  const parsed = parseJSONLinesResponse(response, "", (o) => o);
  const first = await parsed.next();
  assert(!first.done && !first.value.error);
  expect(first.value.value).toEqual(values[0]);
  const second = await parsed.next();
  assert(!second.done && !second.value.error);
  expect(second.value.value).toEqual(values[1]);
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse huuuge list", async () => {
  const values = Array.from({ length: 50000 }, (_, i) => ({ value: i }));
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 200,
    },
  );
  const parsed = parseJSONLinesResponse(response, "", (o) => o);
  for (const value of values) {
    const next = await parsed.next();
    assert(!next.done && !next.value.error);
    expect(next.value.value).toEqual(value);
  }
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse huuuge values", async () => {
  const values = Array.from({ length: 100 }, (_, i) => ({
    value: i.toString().repeat(100000),
  }));
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 200,
    },
  );
  const parsed = parseJSONLinesResponse(response, "", (o) => o);
  for (const value of values) {
    const next = await parsed.next();
    assert(!next.done && !next.value.error);
    expect(next.value.value).toEqual(value);
  }
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});
