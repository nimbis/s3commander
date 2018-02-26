import {FileController} from './FileController';

export const FileComponent: angular.IComponentOptions = {
  bindings: {
    file: '=file'
  },
  template: require('./file.html'),
  controller: FileController
};
