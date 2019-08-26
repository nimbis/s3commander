import * as angular from 'angular';

import {DropzoneDirective} from './dropzone/DropzoneDirective';

import {FileComponent} from './file/FileComponent';
import {FolderComponent} from './folder/FolderComponent';
import {BucketComponent} from './bucket/BucketComponent';
import {STSSessionComponent} from './stssession/STSSessionComponent';
import {DropzoneComponent} from './dropzone/DropzoneComponent';

import {S3SessionComponent} from './s3session/S3SessionComponent';

import './index.css';
import '../node_modules/dropzone/dist/dropzone.css';

// register components and configure the module.
angular
  .module('s3commander', [])
  .config(($sceDelegateProvider: any) => {
    // https://docs.angularjs.org/api/ng/provider/$sceDelegateProvider
    $sceDelegateProvider.resourceUrlWhitelist([
      'self',

      // amazon s3 (generic url, bucket url, bucket url in govcloud regions)
      'https://s3.amazonaws.com/*',
      'https://*.s3.amazonaws.com/',
      'https://*.s3.*.amazonaws.com/'
    ]);
  })
  .directive('dropzone', [() => new DropzoneDirective()])
  .component('file', FileComponent)
  .component('folder', FolderComponent)
  .component('bucket', BucketComponent)
  .component('stssession', STSSessionComponent)
  .component('s3session', S3SessionComponent)
  .component('dropzone', DropzoneComponent);
