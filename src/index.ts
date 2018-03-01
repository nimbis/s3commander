import * as angular from 'angular';

import {FileComponent} from './file/FileComponent';
import {FolderComponent} from './folder/FolderComponent';
import {BucketComponent} from './bucket/BucketComponent';

import './index.css';

// register components and configure the module.
angular
  .module('s3commander', [])
  .config(function ($sceDelegateProvider: any) {
    // https://docs.angularjs.org/api/ng/provider/$sceDelegateProvider
    $sceDelegateProvider.resourceUrlWhitelist([
      'self',
      'https://s3.amazonaws.com/*',
      'https://*.s3.amazonaws.com/'
    ]);
  })
  .component('file', FileComponent)
  .component('folder', FolderComponent)
  .component('bucket', BucketComponent);
