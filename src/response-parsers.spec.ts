import { it, expect } from "vitest";
import {
  parseErrorResponse,
  parseEncodedStringArrayHeader,
  parseGraffitiObjectResponse,
  parseJSONListResponse,
  parseJSONListFetch,
} from "./response-parsers";
import { randomLocation, randomString } from "./test-utils";

it("parse an error string", async () => {
  const message = "error message";
  const response = new Response(message, { status: 400 });
  const error = await parseErrorResponse(response);
  expect(error.message).toBe("error message");
});

it("parse error without message", async () => {
  const response = new Response("", { status: 400 });
  const error = await parseErrorResponse(response);
  expect(error.message).toContain("400");
});

it("parse JSON error", async () => {
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

it("parse null header", async () => {
  const result = parseEncodedStringArrayHeader(null, "default");
  expect(result).toBe("default");
});

it("parse empty header", async () => {
  const result = parseEncodedStringArrayHeader("", "default");
  expect(result).toEqual([]);
});

it("encoded header", async () => {
  const values = ["🪿", "//++  \n👻"];
  const encoded = values.map(encodeURIComponent).join(",");
  const result = parseEncodedStringArrayHeader(encoded, "default");
  expect(result).toEqual(values);
});

it("parse put response", async () => {
  const response = new Response("", {
    status: 201,
  });
  const location = randomLocation(randomString(), randomString());
  const parsed = await parseGraffitiObjectResponse(response, location, false);
  expect(parsed.tombstone).toBe(true);
  expect(parsed.value).toBe(null);
  expect(parsed.channels).toEqual([]);
  expect(parsed.lastModified.getTime()).toBeNaN();
  expect(parsed).toMatchObject(location);
});

it("parse non-get response", async () => {
  const value = { value: "hello" };
  const lastModified = new Date();
  const channels = ["channel1", "channel2"];
  const acl = ["user1", "user2"];
  const response = new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Last-Modified": lastModified.toISOString(),
      Channels: channels.join(","),
      "Access-Control-List": acl.join(","),
    },
  });
  const location = randomLocation(randomString(), randomString());
  const parsed = await parseGraffitiObjectResponse(response, location, false);
  expect(parsed.tombstone).toBe(true);
  expect(parsed.value).toEqual(value);
  expect(parsed.channels).toEqual(channels);
  expect(parsed.acl).toEqual(acl);
  expect(parsed.lastModified.getTime()).toBe(lastModified.getTime());
  expect(parsed).toMatchObject(location);
});

it("parse get response", async () => {
  const value = { value: "hello" };
  const lastModified = new Date();
  const channels = ["channel1", "channel2"];
  const acl = ["user1", "user2"];
  const response = new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Last-Modified": lastModified.toISOString(),
      Channels: channels.join(","),
      "Access-Control-List": acl.join(","),
    },
  });
  const location = randomLocation(randomString(), randomString());
  const parsed = await parseGraffitiObjectResponse(response, location, true);
  expect(parsed.tombstone).toBe(false);
  expect(parsed.value).toEqual(value);
  expect(parsed.channels).toEqual(channels);
  expect(parsed.acl).toEqual(acl);
  expect(parsed.lastModified.getTime()).toBe(lastModified.getTime());
  expect(parsed).toMatchObject(location);
});

it("parse no channels or acl or value or timestamp", async () => {
  const response = new Response("", {
    status: 200,
  });
  const location = randomLocation(randomString(), randomString());
  const parsed = await parseGraffitiObjectResponse(response, location, true);
  expect(parsed.tombstone).toBe(false);
  expect(parsed.value).toBe(null);
  expect(parsed.channels).toEqual([]);
  expect(parsed.acl).toEqual(undefined);
  expect(parsed.lastModified.getTime()).toBeNaN();
  expect(parsed).toMatchObject(location);
});

it("parse response with error", async () => {
  const response = new Response("error message", {
    status: 400,
  });
  const location = randomLocation(randomString(), randomString());
  const parsing = parseGraffitiObjectResponse(response, location, true);
  await expect(parsing).rejects.toMatchObject({
    message: "error message",
  });
});

it("parse basic JSON list", async () => {
  const values = [{ value: "hello" }, { value: "world" }];
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 200,
    },
  );
  const parsed = parseJSONListResponse(response);
  const first = await parsed.next();
  expect(first.value).toMatchObject(values[0]);
  const second = await parsed.next();
  expect(second.value).toMatchObject(values[1]);
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
  const parsed = parseJSONListResponse(response);
  const first = await parsed.next();
  expect(first.value).toMatchObject(values[0]);
  const second = await parsed.next();
  expect(second.value).toMatchObject(values[1]);
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse json list with bad JSON", async () => {
  const good = { good: "json" };
  const response = new Response(
    "not json" +
      "\n" +
      JSON.stringify(good) +
      "\n\n\n" +
      JSON.stringify(["an", "array"]),
    {
      status: 200,
    },
  );
  const parsed = parseJSONListResponse(response);
  const first = await parsed.next();
  expect(first.value).toMatchObject(good);
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse bad bytes", async () => {
  const response = new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), {
    status: 200,
  });
  const parsed = parseJSONListResponse(response);
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
  const parsed = parseJSONListResponse(response);
  for (const value of values) {
    const next = await parsed.next();
    expect(next.value).toMatchObject(value);
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
  const parsed = parseJSONListResponse(response);
  for (const value of values) {
    const next = await parsed.next();
    expect(next.value).toMatchObject(value);
  }
});

it("parse list with errors", async () => {
  const response = new Response("error message", {
    status: 400,
  });
  const parsing = parseJSONListResponse(response);
  expect(await parsing.next()).toHaveProperty("value.error", "error message");
  expect(await parsing.next()).toHaveProperty("done", true);
});

it("parse list fetch with bad uri", async () => {
  for (const example of [
    "nonexistant.uriasdfj",
    "https://example.notfound",
    "ipfs:alsdkfj",
  ]) {
    const iterator = parseJSONListFetch(undefined, example);
    expect(await iterator.next()).toHaveProperty("value.error");
    expect(await iterator.next()).toHaveProperty("done", true);
  }
});
