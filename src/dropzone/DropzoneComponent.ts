import {DropzoneController} from './DropzoneController';

export const DropzoneComponent: angular.IComponentOptions = {
  bindings: {
    config: '=',
    folder: '=',
    backend: '='
  },
  template: require('./dropzone.html'),
  controller: DropzoneController
};
