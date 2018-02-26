import * as angular from 'angular';

import {FileComponent} from './file/FileComponent';
import {FolderComponent} from './folder/FolderComponent';
import {BucketComponent} from './bucket/BucketComponent';

import './index.css';

angular
  .module('s3commander', [])
  .component('file', FileComponent)
  .component('folder', FolderComponent)
  .component('bucket', BucketComponent);
