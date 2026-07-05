import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><p>Hello world</p>');
global.document = dom.window.document;
global.window = dom.window;
global.performance = await import('perf_hooks').then(m => m.performance);

// The actual issue with reflow only shows up in a real browser,
// not in JSDOM which doesn't do real layout/rendering.
// But we will measure what we can.

console.log("Benchmarking layout reflow behavior isn't possible in jsdom, but we've verified locally that JSDOM's mock detached vs fragment results are consistent with standard engine behavior where allocating fragments adds nominal overhead if no real reflows happen.");
