import { it, expect, assert } from "vitest";
import {
  catchResponseErrors,
  parseEncodedStringArrayHeader,
  parseGraffitiObjectResponse,
  parseJSONLinesResponse,
} from "./decode-response";
import { randomBase64 } from "@graffiti-garden/implementation-local/utilities";
import type { GraffitiLocation } from "@graffiti-garden/api";

function randomLocation(): GraffitiLocation {
  return {
    name: randomBase64(),
    actor: randomBase64(),
    source: randomBase64(),
  };
}

it("parse an error string", async () => {
  const message = "error message";
  const response = new Response(message, { status: 400 });
  await expect(catchResponseErrors(response)).rejects.toMatchObject({
    message: "error message",
  });
});

it("parse JSON error", async () => {
  const message = "json error message";
  const response = new Response(
    JSON.stringify({
      message,
      something: "else",
    }),
    { status: 404 },
  );
  await expect(catchResponseErrors(response)).rejects.toMatchObject({
    message,
  });
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

it("parse no last-modified", async () => {
  const response = new Response("{}", {
    status: 200,
    headers: {
      "Last-Modified-Ms": "123",
    },
  });
  const location = randomLocation();
  await expect(
    parseGraffitiObjectResponse(response, location),
  ).rejects.toThrow();
});

it("parse no last-modified-ms", async () => {
  const response = new Response("{}", {
    status: 200,
    headers: {
      "Last-Modified": new Date().toUTCString(),
    },
  });
  const location = randomLocation();
  await expect(
    parseGraffitiObjectResponse(response, location),
  ).rejects.toThrow();
});

it("parse put response", async () => {
  const date = new Date();
  const response = new Response("{}", {
    status: 201,
    headers: {
      "Last-Modified": date.toUTCString(),
      "Last-Modified-Ms": date.getUTCMilliseconds().toString(),
    },
  });
  const location = randomLocation();
  const parsed = await parseGraffitiObjectResponse(response, location, false);
  expect(parsed.tombstone).toBe(true);
  expect(parsed.value).toEqual({});
  expect(parsed.channels).toEqual([]);
  expect(parsed.allowed).toEqual(undefined);
  expect(parsed.lastModified).toEqual(date.getTime());
  expect(parsed).toMatchObject(location);
});

it("parse empty allow", async () => {
  const date = new Date();
  const response = new Response(
    JSON.stringify({
      hello: "world",
    }),
    {
      status: 200,
      headers: {
        "Last-Modified": date.toUTCString(),
        "Last-Modified-Ms": date.getUTCMilliseconds().toString(),
        Allowed: "",
      },
    },
  );
  const location = randomLocation();
  const parsed = await parseGraffitiObjectResponse(response, location, true);
  expect(parsed.tombstone).toBe(false);
  expect(parsed.value).toEqual({ hello: "world" });
  expect(parsed.channels).toEqual([]);
  expect(parsed.allowed).toEqual([]);
  expect(parsed.lastModified).toEqual(date.getTime());
  expect(parsed).toMatchObject(location);
});

it("parse non-get response", async () => {
  const value = { value: "hello" };
  const lastModified = new Date();
  const channels = ["channel1", "channel2"];
  const allowed = ["user1", "user2"];
  const response = new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Last-Modified": lastModified.toUTCString(),
      "Last-Modified-Ms": lastModified.getUTCMilliseconds().toString(),
      Channels: channels.join(","),
      Allowed: allowed.join(","),
    },
  });
  const location = randomLocation();
  const parsed = await parseGraffitiObjectResponse(response, location, false);
  expect(parsed.tombstone).toBe(true);
  expect(parsed.value).toEqual(value);
  expect(parsed.channels).toEqual(channels);
  expect(parsed.allowed).toEqual(allowed);
  expect(parsed.lastModified).toBe(lastModified.getTime());
  expect(parsed).toMatchObject(location);
});

it("parse get response", async () => {
  const value = { value: "hello" };
  const lastModified = new Date();
  const channels = ["channel1", "channel2"];
  const allowed = ["user1", "user2"];
  const response = new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Last-Modified": lastModified.toUTCString(),
      "Last-Modified-Ms": lastModified.getUTCMilliseconds().toString(),
      Channels: channels.join(","),
      Allowed: allowed.join(","),
    },
  });
  const location = randomLocation();
  const parsed = await parseGraffitiObjectResponse(response, location, true);
  expect(parsed.tombstone).toBe(false);
  expect(parsed.value).toEqual(value);
  expect(parsed.channels).toEqual(channels);
  expect(parsed.allowed).toEqual(allowed);
  expect(parsed.lastModified).toBe(lastModified.getTime());
  expect(parsed).toMatchObject(location);
});

it("bad value", async () => {
  const response = new Response("{", {
    status: 200,
    headers: {
      "Last-Modified": new Date().toUTCString(),
      "Last-Modified-Ms": "123",
    },
  });
  const location = randomLocation();
  await expect(
    parseGraffitiObjectResponse(response, location),
  ).rejects.toThrow();
});

it("parse response with extra fields in location", async () => {
  const value = {
    [randomBase64()]: randomBase64(),
  };
  const lastModified = new Date();
  const response = new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "Last-Modified": lastModified.toUTCString(),
      "Last-Modified-Ms": lastModified.getUTCMilliseconds().toString(),
    },
  });
  const location = {
    ...randomLocation(),
    value: { not: "what you expect" },
    some: "extra fields",
  };

  const parsed = await parseGraffitiObjectResponse(response, location, true);
  expect(parsed.tombstone).toBe(false);
  expect(parsed.value).toEqual(value);
  expect(parsed).not.toHaveProperty("some");
});

it("parse response with error", async () => {
  const lastModified = new Date();
  const response = new Response("my error", {
    status: 400,
    headers: {
      "Last-Modified": lastModified.toUTCString(),
      "Last-Modified-Ms": lastModified.getUTCMilliseconds().toString(),
    },
  });
  const location = randomLocation();
  await expect(
    parseGraffitiObjectResponse(response, location),
  ).rejects.toMatchObject({
    message: "my error",
  });
});

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
