import {Bucket} from './Bucket';

export interface IBackend {
  /**
   * Get a bucket with the given name.
   */
  getBucket(name: string): Bucket;
}
