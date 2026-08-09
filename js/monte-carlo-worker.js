/* Runs js/monte-carlo.js off the main thread. 10,000 paths * ~20-30 years of Float64
   percentile sorting would blow well past the 200ms INP budget on the main thread
   (measured 104-160ms worst case there with nothing extra running) — this worker is
   the whole reason that stays true after Phase 6. */
importScripts('monte-carlo.js');

self.onmessage = function (e) {
  const { reqId, ...params } = e.data;
  const result = runMonteCarloProjection(params);
  self.postMessage({ reqId, result });
};
