import { it, expect } from "vitest";
import LinesFeed from "./lines-feed";

it("parse basic JSON lines", async () => {
  const linesFeed = new LinesFeed();
  const values = [{ value: "hello" }, { value: "world" }];
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 200,
    },
  );
  const parsed = linesFeed.parseResponse(response);
  const first = await parsed.next();
  expect(first.value).toBe(JSON.stringify(values[0]));
  const second = await parsed.next();
  expect(second.value).toBe(JSON.stringify(values[1]));
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse json list with newlines", async () => {
  const linesFeed = new LinesFeed();
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
  const parsed = linesFeed.parseResponse(response);
  const first = await parsed.next();
  expect(first.value).toBe(JSON.stringify(values[0]));
  const second = await parsed.next();
  expect(second.value).toBe(JSON.stringify(values[1]));
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse huuuge list", async () => {
  const linesFeed = new LinesFeed();
  const values = Array.from({ length: 50000 }, (_, i) => ({ value: i }));
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 200,
    },
  );
  const parsed = linesFeed.parseResponse(response);
  for (const value of values) {
    const next = await parsed.next();
    expect(next.value).toBe(JSON.stringify(value));
  }
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});

it("parse huuuge values", async () => {
  const linesFeed = new LinesFeed();
  const values = Array.from({ length: 100 }, (_, i) => ({
    value: i.toString().repeat(100000),
  }));
  const response = new Response(
    values.map((v) => JSON.stringify(v)).join("\n"),
    {
      status: 226,
      headers: {
        IM: "prepend",
      },
    },
  );
  const parsed = linesFeed.parseResponse(response);
  for (const value of values) {
    const next = await parsed.next();
    expect(next.value).toBe(JSON.stringify(value));
  }
  await expect(parsed.next()).resolves.toHaveProperty("done", true);
});
