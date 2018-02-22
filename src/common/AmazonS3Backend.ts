import {Bucket} from './Bucket';
import {IBackend} from './IBackend';

export class AmazonS3Backend implements IBackend {
  /**
   * Amazon S3 API endpoint.
   */
  private baseUrl: string;

  /**
   * Create an instance of the backend.
   * @see https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
   */
  constructor(public region: string) {
    this.baseUrl = `s3.${region}.amazonaws.com`;
  }

  /**
   * Get a bucket with the given name.
   */
  getBucket(name: string): Bucket {
    // when the bucket name contains a period ('.') we can't use https
    // because it treats part of the bucket name as a subdomain and breaks SSL
    let protocol = name.includes('.') ? 'http' : 'https';
    return new Bucket(name, `${protocol}://${name}.${this.baseUrl}`);
  }
}
