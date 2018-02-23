/// <reference types="aws-sdk" />

import AWS = require('aws-sdk');

import {Bucket} from './Bucket';
import {IBackend} from './IBackend';

export class AmazonS3Backend implements IBackend {
  /**
   * Amazon S3 API endpoint.
   */
  private s3: AWS.S3;

  /**
   * Create an instance of the backend.
   * @see https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
   */
  constructor(
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken: string = null
  ) {
    this.s3 = new AWS.S3({
      apiVersion: 'latest',
      region: region,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      sessionToken: sessionToken,
      sslEnabled: true
    });
  }

  /**
   * Get a bucket with the given name.
   */
  getBucket(name: string): Promise<Bucket> {
    return this.s3.getBucketVersioning({Bucket: name})
      .promise()
      .then(function (data: any) {
        return new Bucket(name, data.Status === 'Enabled');
      });
  }
}
