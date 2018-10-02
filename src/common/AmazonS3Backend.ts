/// <reference types="aws-sdk" />

import AWS = require('aws-sdk');

import {Bucket} from './Bucket';
import {Path} from './Path';
import {Folder} from './Folder';
import {IFolderContents} from './IFolderContents';
import {IUploadConfig} from './IUploadConfig';
import {File} from './File';
import {IFileVersion} from './IFileVersion';
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
      .then((data: any) => {
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
        let folders = data.CommonPrefixes.map((folderData: any) => {
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
   * Get the deleted contents of a folder.
   *
   * Returns all folders even if they aren't currently deleted. This is because
   * there isn't a way to determine if a folder is deleted without comparing
   * the output of s3.listObjectVersions() and s3.listObjectsV2() and only
   * selecting the folders that are returned by s3.listObjectVersions, but not
   * by s3.listObjectsV2().
   */
  getDeletedContents(bucket: Bucket, folder: Folder): Promise<IFolderContents> {
    var params = {
      Bucket: bucket.name,
      Prefix: folder.getPath().toString(),
      Delimiter: '/'
    };

    return this.s3.listObjectVersions(params)
      .promise()
      .then((data: any) => {
        // extract folder objects
        let folders = data.CommonPrefixes.map((folderData: any) => {
          return new Folder(new Path(folderData.Prefix), true);
        });

        // extract file objects
        let files = data.DeleteMarkers.filter((fileData: any) => {
          // ignore the folder object by comparing it's path
          // and ignore delete versions that are not the current version.
          // without the IsLatest check, if any past versions of the file have
          // the delete marker, then the file will show up, even if it does not
          // currently have the delete marker.

          return fileData.IsLatest && folder.getPath().toString() !== fileData.Key;
        }).map((fileData: any) => {
          let downloadLink = undefined;

          return new File(new Path(fileData.Key), downloadLink, true);
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
        return data.Contents.map((objectData: any) => {
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
   * Get settings necessary to upload files to the given folder.
   *
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createPresignedPost-property
   */
  public getUploadConfig(bucket: Bucket, folder: Folder): IUploadConfig {
    // retrieve post url and fields including pre-signed authorization field
    var params = {
      Bucket: bucket.name,
      Conditions: [
        ['starts-with', '$key', folder.getPath().toString()]
      ],
      Expires: 900
    };

    let config = this.s3.createPresignedPost(params);

    // return the fields and a bucket url instead of the inline url.
    // this avoids a URL redirect issue that can happen when a POST request is
    // sent to a bucket in a different region than the current one
    let genericUrl = new URL(config.url);

    return {
      url: `https://${bucket.name}.${genericUrl.hostname}/`,
      fields: config.fields
    };
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
   * Get full file path given a folder and file.
   */
  public getFilePath(folder: Folder, file: any): string {
    let filePath = file.name;

    if (file.hasOwnProperty('fullPath')) {
      filePath = file.fullPath;
    }

    return folder
        .getPath()
        .clone()
        .push(filePath)
        .toString();
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

  /**
   * Update formData to allow valid POST
   */
  public updateFormData(folder: Folder, file: any, formData: any): Promise<any> {
    // append AWS upload key to the form data
    // needed in order to have a valid POST
    let filePath = file.name;

    if (file.hasOwnProperty('fullPath')) {
      filePath = file.fullPath;
    }

    let key = folder
        .getPath()
        .clone()
        .push(filePath)
        .toString();

    return formData.append('key', key).promise();
  }

  /**
   * Upload file to S3 using ManagedUpload.
   * Expects the following parameters:
   *
   * params = {
   *   Bucket: name of the bucket
   *   Key: filepath
   *   Body: file object
   *   Dropzone: dropzone object
   * }
   */
  public uploadFile(params: any): Promise<any> {
    // add ManagedUpload object to the file
    params.Body.s3upload = new AWS.S3.ManagedUpload({
      params: params,
      service: this.s3
    });
    params.Body.s3upload.computeChecksums = true;

    // add event listener to update upload progress
    params.Body.s3upload.on('httpUploadProgress', function(progress: any) {
      if (progress.total) {
        let percent = (progress.loaded * 100) / progress.total;
        params.Dropzone.emit('uploadprogress', params.Body, percent, progress.loaded);
      }
    });

    return new Promise((resolve: any, reject: any) => {
      params.Body.s3upload.send(function(err: any, data: any) {
        resolve({err: err, data: data});
      });
    });
  }

}
