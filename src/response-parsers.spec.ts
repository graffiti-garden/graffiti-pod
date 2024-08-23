import { it, expect } from "vitest";
import {
  parseErrorResponse,
  parseEncodedStringArrayHeader,
  parseGraffitiObjectResponse,
} from "./response-parsers";
import { randomLocation, randomString, randomValue } from "./test-utils";

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

it("parse response with extra fields in location", async () => {
  const value = randomValue();
  const response = new Response(JSON.stringify(value), {
    status: 200,
  });
  const location = {
    ...randomLocation(randomString(), randomString()),
    value: { not: "what you expect" },
    some: "extra fields",
  };

  const parsed = await parseGraffitiObjectResponse(response, location, true);
  expect(parsed.tombstone).toBe(false);
  expect(parsed.value).toEqual(value);
  expect(parsed).not.toHaveProperty("some");
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
