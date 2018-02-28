/// <reference types="aws-sdk" />

import AWS = require('aws-sdk');

import {Path} from './Path';
import {StorageBucket} from './StorageBucket';
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
  public getBucket(name: string): Promise<StorageBucket> {
    return this.s3.getBucketVersioning({Bucket: name})
      .promise()
      .then(function (data: any) {
        return new StorageBucket(name, data.Status === 'Enabled');
      });
  }

  /**
   * Get bucket objects with a given prefix.
   */
  public getObjects(bucket: StorageBucket, prefix: Path): Promise<StorageObject[]> {
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
          return new StorageObject(new Path(folderData.Prefix));
        });

        // extract file objects
        let files = data.Contents.map(function (fileData: any) {
          return new StorageObject(new Path(fileData.Key));
        }).filter(function (object: StorageObject) {
          // ignore the folder object by comparing it's path
          return !object.path.equals(prefix);
        });

        // return all objects
        return folders.concat(files);
      });
  }

  /**
   * Delete multiple objects from the bucket.
   */
  public deleteObjects(bucket: StorageBucket, prefix: Path): Promise<any> {
    var getParams = {
      Bucket: bucket.name,
      Prefix: prefix.toString()
    };

    return this.s3.listObjectsV2(getParams)
      .promise()
      .then((data: any) => {
        return data.Contents.map(function (objectData: any) {
          return {Key: objectData.Key};
        });
      })
      .then((objects: any[]) => {
        var deleteParams = {
          Bucket: bucket.name,
          Delete: {
            Objects: objects
          }
        };

        return this.s3.deleteObjects(deleteParams).promise();
      });
  }
}
