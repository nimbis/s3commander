import {FileController} from './FileController';

export const FileComponent: angular.IComponentOptions = {
  bindings: {
    file: '=',
    versioned: '=',
    onLoadVersions: '&',
    onDelete: '&'
  },
  template: require('./file.html'),
  controller: FileController
};
