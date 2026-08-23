import { describe, it, expect } from "vitest";
import { parseJsonArray } from "./utils";

describe("parseJsonArray", () => {
  it("parses pure JSON array string", () => {
    const input = '["hello", "world"]';
    expect(parseJsonArray<string>(input)).toEqual(["hello", "world"]);
  });

  it("parses JSON array with whitespace", () => {
    const input = '   \n  ["foo", "bar"] \n\n ';
    expect(parseJsonArray<string>(input)).toEqual(["foo", "bar"]);
  });

  it("parses JSON array wrapped in markdown code blocks", () => {
    const input = '```json\n["one", "two"]\n```';
    expect(parseJsonArray<string>(input)).toEqual(["one", "two"]);
  });

  it("parses JSON array wrapped in generic code blocks", () => {
    const input = '```\n["apple", "banana"]\n```';
    expect(parseJsonArray<string>(input)).toEqual(["apple", "banana"]);
  });

  it("extracts JSON array when accompanied by extra text or explanations", () => {
    const input = 'Here is your translated array:\n["alpha", "beta"]\nHope this helps!';
    expect(parseJsonArray<string>(input)).toEqual(["alpha", "beta"]);
  });

  it("throws error if parsed result is a JSON object instead of an array", () => {
    const input = '{"key": "value"}';
    expect(() => parseJsonArray(input)).toThrow("Parsed result is not a valid JSON array");
  });

  it("throws error on invalid JSON string", () => {
    const input = "This is not JSON at all";
    expect(() => parseJsonArray(input)).toThrow("Parsed result is not a valid JSON array");
  });
});
