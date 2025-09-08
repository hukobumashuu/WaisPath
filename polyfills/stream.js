// very small shim - returns a minimal readable stream stub
class Readable {
  constructor() {}
}
module.exports = {
  Readable,
  // lightweight no-op replacements; if Firebase needs more,
  // prefer installing stream-browserify instead.
};
