import browser from "../lib/browser-compat";

export const htmlTagsInlineText = [
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "data",
  "dfn",
  "em",
  "font",
  "i",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
];

export const htmlTagsInlineIgnore = [
  "code",
  "script",
  "style",
  "noscript",
  "textarea",
  "pre",
];

export interface PieceToTranslate {
  isTranslated: boolean;
  isTranslating: boolean;
  parentElement: Node | null;
  topElement: Element | null;
  bottomElement: Element | null;
  nodes: Text[];
}

export interface NodeToRestore {
  node: Text;
  originalText: string;
  translatedText: string;
}

let piecesToTranslate: PieceToTranslate[] = [];
let nodesToRestore: NodeToRestore[] = [];
let isTranslationActive = false;
let translationRoutineHandler: number | null = null;
let currentTargetLang = "en"; // Default

export function isNoTranslateNode(node: Element): boolean {
  if (
    node.nodeName.toLowerCase() === "code" ||
    node.nodeName.toLowerCase() === "pre" ||
    node.classList.contains("notranslate") ||
    node.getAttribute("translate") === "no"
  ) {
    return true;
  }
  return false;
}

export function getPiecesToTranslate(root: Node = document.documentElement): PieceToTranslate[] {
  const pieces: PieceToTranslate[] = [
    {
      isTranslated: false,
      isTranslating: false,
      parentElement: null,
      topElement: null,
      bottomElement: null,
      nodes: [],
    },
  ];
  let index = 0;
  let currentParagraphSize = 0;

  function getAllNodes(node: Node, lastHTMLElement: Element | null = null) {
    if (node.nodeType === 1 || node.nodeType === 11) {
      if (node.nodeType === 11) {
        lastHTMLElement = (node as ShadowRoot).host;
      } else if (node.nodeType === 1) {
        lastHTMLElement = node as Element;
        const nodeName = node.nodeName.toLowerCase();

        if (
          htmlTagsInlineIgnore.includes(nodeName) ||
          isNoTranslateNode(node as Element) ||
          (node as HTMLElement).isContentEditable
        ) {
          if (pieces[index]!.nodes.length > 0) {
            currentParagraphSize = 0;
            pieces[index]!.bottomElement = lastHTMLElement;
            pieces.push({
              isTranslated: false,
              isTranslating: false,
              parentElement: null,
              topElement: null,
              bottomElement: null,
              nodes: [],
            });
            index++;
          }
          return;
        }
      }

      function getAllChilds(childNodes: NodeListOf<ChildNode>) {
        Array.from(childNodes).forEach((_node) => {
          const nodeName = _node.nodeName.toLowerCase();
          if (_node.nodeType === 1) {
            lastHTMLElement = _node as Element;
          }

          if (_node.nodeType === 1 && !htmlTagsInlineText.includes(nodeName)) {
            if (pieces[index]!.nodes.length > 0) {
              currentParagraphSize = 0;
              pieces[index]!.bottomElement = lastHTMLElement;
              pieces.push({
                isTranslated: false,
                isTranslating: false,
                parentElement: null,
                topElement: null,
                bottomElement: null,
                nodes: [],
              });
              index++;
            }
            getAllNodes(_node, lastHTMLElement);
            if (pieces[index]!.nodes.length > 0) {
              currentParagraphSize = 0;
              pieces[index]!.bottomElement = lastHTMLElement;
              pieces.push({
                isTranslated: false,
                isTranslating: false,
                parentElement: null,
                topElement: null,
                bottomElement: null,
                nodes: [],
              });
              index++;
            }
          } else {
            getAllNodes(_node, lastHTMLElement);
          }
        });
      }

      getAllChilds(node.childNodes);
      if (!pieces[index]!.bottomElement) {
        pieces[index]!.bottomElement = node as Element;
      }
      if ((node as Element).shadowRoot) {
        getAllChilds((node as Element).shadowRoot!.childNodes);
      }
    } else if (node.nodeType === 3) {
      if (node.textContent && node.textContent.trim().length > 0) {
        if (!pieces[index]!.parentElement) {
          pieces[index]!.parentElement = node.parentNode;
        }
        if (!pieces[index]!.topElement) {
          pieces[index]!.topElement = lastHTMLElement;
        }
        if (currentParagraphSize > 1000) {
          currentParagraphSize = 0;
          pieces[index]!.bottomElement = lastHTMLElement;
          pieces.push({
            isTranslated: false,
            isTranslating: false,
            parentElement: pieces[index]!.parentElement,
            topElement: lastHTMLElement,
            bottomElement: null,
            nodes: [],
          });
          index++;
        }
        currentParagraphSize += node.textContent.length;
        pieces[index]!.nodes.push(node as Text);
        pieces[index]!.bottomElement = null;
      }
    }
  }

  getAllNodes(root);

  if (pieces.length > 0 && pieces[pieces.length - 1]!.nodes.length === 0) {
    pieces.pop();
  }

  return pieces;
}

function topIsInScreen(element: Element | null): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.top > -500 && rect.top <= window.innerHeight + 500;
}

function bottomIsInScreen(element: Element | null): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.bottom > -500 && rect.bottom <= window.innerHeight + 500;
}

async function translateBatch(pieces: PieceToTranslate[]) {
  const textsToTranslate = pieces.flatMap((p) => p.nodes.map((n) => n.textContent || ""));
  
  // Send message to background script
  try {
    const response = (await browser.runtime.sendMessage({
      type: "translate-page-chunks",
      texts: textsToTranslate,
      targetLang: currentTargetLang,
    })) as any;
    
    if (response && response.ok && response.translatedTexts) {
      const translatedTexts = response.translatedTexts as string[];
      let offset = 0;
      
      for (const piece of pieces) {
        for (let i = 0; i < piece.nodes.length; i++) {
          const originalTextNode = piece.nodes[i]!;
          const translated = translatedTexts[offset] || originalTextNode.textContent || "";
          offset++;
          
          nodesToRestore.push({
            node: originalTextNode,
            originalText: originalTextNode.textContent || "",
            translatedText: translated
          });
          
          originalTextNode.textContent = translated;
        }
        piece.isTranslated = true;
      }
    } else {
      pieces.forEach(p => p.isTranslating = false);
    }
  } catch (error) {
    console.error("Error translating page chunk:", error);
    pieces.forEach(p => p.isTranslating = false);
  }
}

function translationRoutine() {
  if (!isTranslationActive) return;

  const piecesToTranslateNow: PieceToTranslate[] = [];
  
  for (const ptt of piecesToTranslate) {
    if (!ptt.isTranslated && !ptt.isTranslating) {
      if (bottomIsInScreen(ptt.topElement) || topIsInScreen(ptt.bottomElement)) {
        ptt.isTranslating = true;
        piecesToTranslateNow.push(ptt);
        // Batch size limit to avoid massive API requests
        if (piecesToTranslateNow.length >= 10) break; 
      }
    }
  }

  if (piecesToTranslateNow.length > 0) {
    translateBatch(piecesToTranslateNow);
  }

  translationRoutineHandler = window.setTimeout(translationRoutine, 300);
}

export function startPageTranslation(targetLang: string = "en") {
  currentTargetLang = targetLang;
  if (!isTranslationActive) {
    isTranslationActive = true;
    piecesToTranslate = getPiecesToTranslate();
    translationRoutine();
  }
}

export function stopPageTranslation() {
  isTranslationActive = false;
  if (translationRoutineHandler !== null) {
    clearTimeout(translationRoutineHandler);
  }
  
  // Restore original texts
  for (const item of nodesToRestore) {
    if (item.node.textContent === item.translatedText) {
      item.node.textContent = item.originalText;
    }
  }
  
  piecesToTranslate = [];
  nodesToRestore = [];
}
