/// <reference types="aws-sdk" />

import AWS = require('aws-sdk');

import {Path} from './Path';
import {Bucket} from './Bucket';
import {File} from './File';
import {IFileVersion} from './IFileVersion';
import {Folder} from './Folder';
import {IFolderContents} from './IFolderContents';
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
      sslEnabled: true,
      signatureVersion: 'v4'
    });
  }

  /**
   * Get a bucket with the given name.
   */
  public getBucket(name: string): Promise<Bucket> {
    return this.s3.getBucketVersioning({Bucket: name})
      .promise()
      .then(function (data: any) {
        return new Bucket(name, data.Status === 'Enabled');
      });
  }

  /**
   * Get the contents of a folder.
   */
  getContents(bucket: Bucket, folder: Folder): Promise<IFolderContents> {
    var params = {
      Bucket: bucket.name,
      Prefix: folder.getPath().toString(),
      Delimiter: '/'
    };

    return this.s3.listObjectsV2(params)
      .promise()
      .then((data: any) => {
        // extract folder objects
        let folders = data.CommonPrefixes.map(function (folderData: any) {
          return new Folder(new Path(folderData.Prefix));
        });

        // extract file objects
        let files = data.Contents.filter((fileData: any) => {
          // ignore the folder object by comparing it's path
          return folder.getPath().toString() !== fileData.Key;
        }).map((fileData: any) => {
          let downloadLink = this.s3.getSignedUrl('getObject', {
            Bucket: bucket.name,
            Key: fileData.Key,
            Expires: 900
          });

          return new File(new Path(fileData.Key), downloadLink);
        });

        // return the contents
        return {
          folders: folders,
          files: files
        };
      });
  }

  /**
   * Create a folder.
   */
  createFolder(bucket: Bucket, folder: Folder): Promise<any> {
    var params = {
      Bucket: bucket.name,
      Key: folder.getPath().toString(),
      Body: ''
    };

    return this.s3.putObject(params).promise();
  }

  /**
   * Delete a folder and its contents.
   */
  deleteFolder(bucket: Bucket, folder: Folder): Promise<any> {
    var getParams = {
      Bucket: bucket.name,
      Prefix: folder.getPath().toString()
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

  /**
   * Get versions of the given file.
   */
  public getFileVersions(bucket: Bucket, file: File): Promise<IFileVersion[]> {
    var params = {
      Bucket: bucket.name,
      Prefix: file.getPath().toString()
    };

    return this.s3.listObjectVersions(params)
      .promise()
      .then((data: any) => {
        // extract file versions
        let versions = data.Versions.map((versionData: any) => {
          let downloadLink = this.s3.getSignedUrl('getObject', {
            Bucket: bucket.name,
            Key: file.getPath().toString(),
            VersionId: versionData.VersionId,
            Expires: 900
          });

          return {
            latest: versionData.IsLatest,
            versionId: versionData.VersionId,
            lastModified: versionData.LastModified,
            deleteMarker: false,
            downloadLink: downloadLink
          };
        });

        // extract deletion markers
        let markers = data.DeleteMarkers.map((markerData: any) => {
          return {
            latest: markerData.IsLatest,
            versionId: markerData.VersionId,
            lastModified: markerData.LastModified,
            deleteMarker: true,
            downloadLink: null
          };
        });

        // return versions and markers
        return versions.concat(markers);
      });
  }

  /**
   * Delete a file.
   */
  deleteFile(bucket: Bucket, file: File): Promise<any> {
    var params = {
      Bucket: bucket.name,
      Key: file.getPath().toString()
    };

    return this.s3.deleteObject(params).promise();
  }
}
