import { describe, it, expect, beforeEach } from "vitest";
import {
  $,
  $btn,
  $input,
  $textarea,
  $select,
  $div,
  $span,
  $heading,
  $form,
  getValue,
  setValue,
} from "./dom";

describe("dom helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("retrieves elements with $ helper", () => {
    document.body.innerHTML = `<div id="test-div">hello</div>`;
    const el = $<HTMLDivElement>("test-div");
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe("hello");
  });

  it("returns null when element is not found", () => {
    expect($("non-existent")).toBeNull();
    expect($btn("non-existent")).toBeNull();
    expect($input("non-existent")).toBeNull();
    expect($textarea("non-existent")).toBeNull();
    expect($select("non-existent")).toBeNull();
    expect($div("non-existent")).toBeNull();
    expect($span("non-existent")).toBeNull();
    expect($heading("non-existent")).toBeNull();
    expect($form("non-existent")).toBeNull();
  });

  it("retrieves specific elements with helper functions", () => {
    document.body.innerHTML = `
      <button id="btn-1">Click</button>
      <input id="input-1" value="val" />
      <textarea id="txt-1">text</textarea>
      <select id="sel-1"></select>
      <div id="div-1">div</div>
      <span id="span-1">span</span>
      <h1 id="head-1">heading</h1>
      <form id="form-1"></form>
    `;

    expect($btn("btn-1")).toBeInstanceOf(HTMLButtonElement);
    expect($input("input-1")).toBeInstanceOf(HTMLInputElement);
    expect($textarea("txt-1")).toBeInstanceOf(HTMLTextAreaElement);
    expect($select("sel-1")).toBeInstanceOf(HTMLSelectElement);
    expect($div("div-1")).toBeInstanceOf(HTMLDivElement);
    expect($span("span-1")).toBeInstanceOf(HTMLSpanElement);
    expect($heading("head-1")).toBeInstanceOf(HTMLHeadingElement);
    expect($form("form-1")).toBeInstanceOf(HTMLFormElement);
  });

  it("gets and sets element values correctly", () => {
    document.body.innerHTML = `
      <input id="input-1" value="initial" />
    `;

    expect(getValue("input-1")).toBe("initial");
    setValue("input-1", "updated");
    expect(getValue("input-1")).toBe("updated");

    expect(getValue("non-existent")).toBe("");
    setValue("non-existent", "test");
  });
});
