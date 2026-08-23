import { describe, it, expect, beforeEach } from "vitest";
import {
  getPiecesToTranslate,
  isNoTranslateNode,
} from "./pageTranslator";

describe("pageTranslator", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isNoTranslateNode", () => {
    it("identifies code and pre tags as no-translate", () => {
      const code = document.createElement("code");
      const pre = document.createElement("pre");
      const div = document.createElement("div");

      expect(isNoTranslateNode(code)).toBe(true);
      expect(isNoTranslateNode(pre)).toBe(true);
      expect(isNoTranslateNode(div)).toBe(false);
    });

    it("identifies elements with class notranslate or translate='no'", () => {
      const elWithClass = document.createElement("div");
      elWithClass.classList.add("notranslate");

      const elWithAttr = document.createElement("div");
      elWithAttr.setAttribute("translate", "no");

      expect(isNoTranslateNode(elWithClass)).toBe(true);
      expect(isNoTranslateNode(elWithAttr)).toBe(true);
    });
  });

  describe("getPiecesToTranslate", () => {
    it("extracts pieces to translate from DOM tree", () => {
      document.body.innerHTML = `
        <div>
          <p>Hello <span>world</span>!</p>
          <p>Second paragraph</p>
        </div>
      `;

      const pieces = getPiecesToTranslate(document.body);
      expect(pieces.length).toBeGreaterThan(0);

      const allText = pieces
        .flatMap((p) => p.nodes)
        .map((n) => n.textContent)
        .join("");

      expect(allText).toContain("Hello ");
      expect(allText).toContain("world");
      expect(allText).toContain("Second paragraph");
    });

    it("ignores code, pre, notranslate, and editable content", () => {
      const container = document.createElement("div");

      const p = document.createElement("p");
      p.textContent = "Normal text";

      const code = document.createElement("code");
      code.textContent = "Code text";

      const pre = document.createElement("pre");
      pre.textContent = "Pre text";

      const noTransClass = document.createElement("div");
      noTransClass.className = "notranslate";
      noTransClass.textContent = "Ignore class text";

      const noTransAttr = document.createElement("div");
      noTransAttr.setAttribute("translate", "no");
      noTransAttr.textContent = "Ignore attr text";

      const editable = document.createElement("div");
      Object.defineProperty(editable, "isContentEditable", { value: true });
      editable.textContent = "Editable text";

      document.body.appendChild(container);
      container.appendChild(p);
      container.appendChild(code);
      container.appendChild(pre);
      container.appendChild(noTransClass);
      container.appendChild(noTransAttr);
      container.appendChild(editable);

      const pieces = getPiecesToTranslate(document.body);
      const allText = pieces
        .flatMap((p) => p.nodes)
        .map((n) => n.textContent)
        .join("");

      expect(allText).toContain("Normal text");
      expect(allText).not.toContain("Code text");
      expect(allText).not.toContain("Pre text");
      expect(allText).not.toContain("Ignore class text");
      expect(allText).not.toContain("Ignore attr text");
      expect(allText).not.toContain("Editable text");
    });

    it("splits pieces when text exceeds 1000 characters", () => {
      const longString1 = "A".repeat(600);
      const longString2 = "B".repeat(600);

      const div = document.createElement("div");
      const p1 = document.createElement("p");
      p1.textContent = longString1;
      const p2 = document.createElement("p");
      p2.textContent = longString2;

      div.appendChild(p1);
      div.appendChild(p2);
      document.body.appendChild(div);

      const pieces = getPiecesToTranslate(div);
      expect(pieces.length).toBeGreaterThan(1);
    });

    it("handles shadow root elements correctly", () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: "open" });
      const shadowP = document.createElement("p");
      shadowP.textContent = "Shadow DOM text";
      shadow.appendChild(shadowP);

      const pieces = getPiecesToTranslate(document.body);
      const allText = pieces
        .flatMap((p) => p.nodes)
        .map((n) => n.textContent)
        .join("");

      expect(allText).toContain("Shadow DOM text");
    });
  });
});
