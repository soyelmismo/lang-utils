var NUM_ITERATIONS = 10000;
var NUM_ELEMENTS = 100;
function benchDetached() {
    var start = performance.now();
    for (var i = 0; i < NUM_ITERATIONS; i++) {
        var div = document.createElement('div');
        for (var j = 0; j < NUM_ELEMENTS; j++) {
            var btn = document.createElement('button');
            div.appendChild(btn);
        }
    }
    return performance.now() - start;
}
function benchFragment() {
    var start = performance.now();
    for (var i = 0; i < NUM_ITERATIONS; i++) {
        var div = document.createElement('div');
        var frag = document.createDocumentFragment();
        for (var j = 0; j < NUM_ELEMENTS; j++) {
            var btn = document.createElement('button');
            frag.appendChild(btn);
        }
        div.appendChild(frag);
    }
    return performance.now() - start;
}
// Warmup
benchDetached();
benchFragment();
var timeDetached = benchDetached();
var timeFragment = benchFragment();
console.log("Detached element appends: ".concat(timeDetached.toFixed(2), "ms"));
console.log("Fragment appends: ".concat(timeFragment.toFixed(2), "ms"));
export {};
