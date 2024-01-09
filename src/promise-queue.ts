/**
 * Interface to describe a queued promise in a `PromiseQueue`.
 */
interface QueuedPromise<T = any> {
  promise: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

/**
 * A simple Promise Queue to allow the execution of some tasks in the correct order.
 *
 * (c) Peter Müller <peter@crycode.de>
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
    if (this.working) {
      return false;
    }

    const item = this.queue.shift();
    if (!item) {
      return false;
    }

    try {
      this.working = true;
      item.promise()
        .then((value) => {
          item.resolve(value);
        })
        .catch((err) => {
          item.reject(err);
        })
        .finally(() => {
          this.working = false;
          this.dequeue()
        });

    } catch (err) {
      item.reject(err);
      this.working = false;
      this.dequeue();
    }

    return true;
  }
}
