/*
 * Promise Queue
 *
 * Copyright(c) 2021-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 */

/**
 * Interface to describe a queued promise in a `PromiseQueue`.
 */
interface QueuedPromise<T = any> {
  promise: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

const debug: boolean = false;
/**
 * A simple Promise Queue to allow the execution of some tasks in the correct order.
 */
export class PromiseQueue {

  /**
   * Queued Promises.
   */
  private queue: QueuedPromise[] = [];

  /**
   * Indicator that we are working on a Promise.
   */
  private working: boolean = false;

  /**
   * The maximum length of the queue.
   */
  private maxQueueLength: number | undefined = undefined;

  /**
   * Create a Promise Queue.
   * @param maxQueueLength Optional maximum allowed length of the queue.
   */
  constructor (maxQueueLength?: number) {
    if (typeof maxQueueLength === 'number') {
      this.maxQueueLength = maxQueueLength;
    }
  }

  /**
   * Enqueue a Promise.
   * This adds the given Promise to the queue. If the queue was empty the Promise
   * will be started immediately.
   * If the PromiseQueue was initialized with a maximum length and the Promise to
   * enqueue would exceed the limit, a Promise rejection will be returned instant.
   * @param promise Function which returns the Promise.
   * @returns A Promise which will be resolved (or rejected) if the queued promise is done. Or an instant Promise rejection if the maximum allowed queue length is exceeded.
   */
  public enqueue<T = void> (promise: () => Promise<T>): Promise<T> {
    debug && console.log('enqueue queueLength:%o', this.queue.length);
    //console.log('enqueue stack:%o', new Error().stack);
    // check the maximum queue length
    if (this.maxQueueLength !== undefined && this.queue.length >= this.maxQueueLength) {
      return Promise.reject('Maximum queue length exceeded');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        promise,
        resolve,
        reject,
      });
      debug && console.log('enqueue promise push about to dequeue().  queueLength:%o promise:%o', this.queue.length, promise);
      this.dequeue();
    });
  }

  /**
   * Returns if the queue is empty and no more Promises are queued.
   * @returns `true` if a Promise is active.
   */
  public isEmpty(): boolean {
    return !this.working && this.queue.length == 0;
  }

  /**
   * Get the first Promise of the queue and start it if there is no other
   * Promise currently active.
   * @returns `true` if Promise from the queue is started, `false` there is already an other active Promise or the queue is empty.
   */
  private dequeue (): boolean {
    debug && console.log('dequeue begin queueLength:%o working:%o', this.queue.length, this.working);
    //console.log('dequeue stack:%o', new Error().stack);
    if (this.working) {
      debug && console.log('dequeue already working.  return false');
      return false;
    }

    const item = this.queue.shift();
    if (!item) {
      debug && console.log('dequeue empty queue.  return false');
      return false;
    }
    let resolveInvoked = false;
    let catchInvoked = false;
    let finallyInvoked = false;
    try {
      this.working = true;
      debug && console.log('dequeue invoke promise queueLength:%o working:%o', this.queue.length, this.working);
      item.promise()
        .then((value) => {
          debug && console.log('dequeue .then resolve handler. value:%o', value);
          item.resolve(value);
          resolveInvoked = true;
        })
        .catch((err) => {
          debug &&  console.log('dequeue .catch handler reject. err:%o', err);
          item.reject(err);
          catchInvoked = true;
        })
        .finally(() => {
          this.working = false;
          debug && console.log('dequeue .finally handler queueLength:%o working:%o', this.queue.length, this.working);
          finallyInvoked = true;
          debug && console.log('dequeue .finally handler before recursive call resolve:%o catch:%o finally:%o', resolveInvoked, catchInvoked, finallyInvoked);
          this.dequeue()
        });

    } catch (err) {
      debug && console.log('dequeue catch reject. err:%o', err);
      item.reject(err);
      this.working = false;
      debug && console.log('dequeue catch reject before recursive call resolve:%o catch:%o finally:%o', resolveInvoked, catchInvoked, finallyInvoked);
      this.dequeue();
    }

    // LRM Bugfix - If we manage to get here and there are still outstanding items on the queue, must again call dequeue
    //              This happens when we enqueue a promise that then calls enqueue(async () => { await someOperation } as is done in _enqueuePoll
    if (this.working && !resolveInvoked && !catchInvoked && !finallyInvoked && this.queue.length != 0) {
      //console.log('dequeue bugfix bypass resolve:%o catch:%o finally:%o queueLength:%o working:%o', resolveInvoked, catchInvoked, finallyInvoked, this.queue.length, this.working);
      //this.working = false;
      //this.dequeue();
    }

    debug && console.log('dequeue before return resolve:%o catch:%o finally:%o queueLength:%o working:%o', resolveInvoked, catchInvoked, finallyInvoked, this.queue.length, this.working);
    //console.log('dequeue before return stack:%o', new Error().stack);
    return true;
  }
}
