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

const NODE_TYPE_ELEMENT = 1;
const NODE_TYPE_TEXT = 3;
const NODE_TYPE_DOCUMENT_FRAGMENT = 11;
const MAX_PARAGRAPH_SIZE = 1000;

interface TranslationState {
  pieces: PieceToTranslate[];
  index: number;
  currentParagraphSize: number;
  lastHTMLElement: Element | null;
}

function createEmptyPiece(
  parentElement: Node | null = null,
  topElement: Element | null = null
): PieceToTranslate {
  return {
    isTranslated: false,
    isTranslating: false,
    parentElement,
    topElement,
    bottomElement: null,
    nodes: [],
  };
}

function createNewPiece(
  state: TranslationState,
  parentElement: Node | null = null,
  topElement: Element | null = null
) {
  state.currentParagraphSize = 0;
  state.pieces[state.index]!.bottomElement = state.lastHTMLElement;
  state.pieces.push(createEmptyPiece(parentElement, topElement));
  state.index++;
}

function processChildNodes(
  childNodes: NodeListOf<ChildNode>,
  state: TranslationState
) {
  Array.from(childNodes).forEach((_node) => {
    const nodeName = _node.nodeName.toLowerCase();
    if (_node.nodeType === NODE_TYPE_ELEMENT) {
      state.lastHTMLElement = _node as Element;
    }

    if (_node.nodeType === NODE_TYPE_ELEMENT && !htmlTagsInlineText.includes(nodeName)) {
      if (state.pieces[state.index]!.nodes.length > 0) {
        createNewPiece(state);
      }
      traverseNode(_node, state);
      if (state.pieces[state.index]!.nodes.length > 0) {
        createNewPiece(state);
      }
    } else {
      traverseNode(_node, state);
    }
  });
}

function traverseNode(node: Node, state: TranslationState) {
  if (node.nodeType === NODE_TYPE_ELEMENT || node.nodeType === NODE_TYPE_DOCUMENT_FRAGMENT) {
    if (node.nodeType === NODE_TYPE_DOCUMENT_FRAGMENT) {
      state.lastHTMLElement = (node as ShadowRoot).host;
    } else if (node.nodeType === NODE_TYPE_ELEMENT) {
      state.lastHTMLElement = node as Element;
      const nodeName = node.nodeName.toLowerCase();

      if (
        htmlTagsInlineIgnore.includes(nodeName) ||
        isNoTranslateNode(node as Element) ||
        (node as HTMLElement).isContentEditable
      ) {
        if (state.pieces[state.index]!.nodes.length > 0) {
          createNewPiece(state);
        }
        return;
      }
    }

    processChildNodes(node.childNodes, state);
    if (!state.pieces[state.index]!.bottomElement) {
      state.pieces[state.index]!.bottomElement = node as Element;
    }
    if ((node as Element).shadowRoot) {
      processChildNodes((node as Element).shadowRoot!.childNodes, state);
    }
  } else if (node.nodeType === NODE_TYPE_TEXT) {
    if (node.textContent && node.textContent.trim().length > 0) {
      const currentPiece = state.pieces[state.index]!;
      if (!currentPiece.parentElement) {
        currentPiece.parentElement = node.parentNode;
      }
      if (!currentPiece.topElement) {
        currentPiece.topElement = state.lastHTMLElement;
      }
      if (state.currentParagraphSize > MAX_PARAGRAPH_SIZE) {
        createNewPiece(state, currentPiece.parentElement, state.lastHTMLElement);
      }
      state.currentParagraphSize += node.textContent.length;
      state.pieces[state.index]!.nodes.push(node as Text);
      state.pieces[state.index]!.bottomElement = null;
    }
  }
}

export function getPiecesToTranslate(root: Node = document.documentElement): PieceToTranslate[] {
  const state: TranslationState = {
    pieces: [createEmptyPiece()],
    index: 0,
    currentParagraphSize: 0,
    lastHTMLElement: null,
  };

  traverseNode(root, state);

  if (state.pieces.length > 0 && state.pieces[state.pieces.length - 1]!.nodes.length === 0) {
    state.pieces.pop();
  }

  return state.pieces;
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
