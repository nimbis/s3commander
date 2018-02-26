/// <reference types="aws-sdk" />

import AWS = require('aws-sdk');

import {Path} from './Path';
import {Bucket} from './Bucket';
import {StorageObject} from './StorageObject';
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

  /**
   * Get bucket objects with a given prefix.
   */
  getObjects(bucket: Bucket, prefix: Path): Promise<StorageObject[]> {
    if (!prefix.isFolder()) {
      throw `Bucket prefix is not a folder: ${prefix}`;
    }

    var params = {
      Bucket: bucket.name,
      Prefix: prefix.toString(),
      Delimiter: '/'
    };

    return this.s3.listObjectsV2(params)
      .promise()
      .then(function (data: any) {
        // extract folder objects
        let folders = data.CommonPrefixes.map(function (folderData: any) {
          return new StorageObject(new Path(folderData.Prefix)); // XXX: extend from prefix
        });

        // extract file objects
        let files = data.Contents.map(function (fileData: any) {
          return new StorageObject(new Path(fileData.Key)); // XXX: extend from prefix
        });

        // return all objects
        return folders + files;
      });
  }
}
