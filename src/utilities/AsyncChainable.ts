/*
  This class allows overloading of Promises passed into the "chain" method
  because functions in JavaScript are essentially objects.
  This allows chaining of asynchronous methods in a synchronous way.
 */

class AsyncChainable {
  readonly _methods;
  constructor() {
    this._methods = {};

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(
      (key) => key !== 'constructor'
    );
    for (const key of keys) {
      this._methods[key] = function (...args) {
        /*
          this here refers to a Promise instance
          All methods are changed to attach to a running Promise chain
         */
        return that.chain(this.then(() => that[key](...args)));
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain(promise: Promise<any>): Promise<any> {
    /*
      After the first method execution,
      all subsequent chained calls will attach to a running
      Promise chain thanks to the method changes in constructor
     */
    return Object.assign(promise, this._methods);
  }
}

export default AsyncChainable;
