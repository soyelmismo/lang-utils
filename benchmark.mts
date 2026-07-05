const NUM_ITERATIONS = 10000;
const NUM_ELEMENTS = 100;

function benchDetached() {
    const start = performance.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        const div = document.createElement('div');
        for (let j = 0; j < NUM_ELEMENTS; j++) {
            const btn = document.createElement('button');
            div.appendChild(btn);
        }
    }
    return performance.now() - start;
}

function benchFragment() {
    const start = performance.now();
    for (let i = 0; i < NUM_ITERATIONS; i++) {
        const div = document.createElement('div');
        const frag = document.createDocumentFragment();
        for (let j = 0; j < NUM_ELEMENTS; j++) {
            const btn = document.createElement('button');
            frag.appendChild(btn);
        }
        div.appendChild(frag);
    }
    return performance.now() - start;
}

// Warmup
benchDetached();
benchFragment();

const timeDetached = benchDetached();
const timeFragment = benchFragment();

console.log(`Detached element appends: ${timeDetached.toFixed(2)}ms`);
console.log(`Fragment appends: ${timeFragment.toFixed(2)}ms`);
