import {FileController} from './FileController';

export const FileComponent: angular.IComponentOptions = {
  bindings: {
    file: '=',
    onDownload: '&',
    onDelete: '&'
  },
  template: require('./file.html'),
  controller: FileController
};
