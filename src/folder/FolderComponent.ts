import {FolderController} from './FolderController';

export const FolderComponent: angular.IComponentOptions = {
  bindings: {
    folder: '=folder'
  },
  template: require('./folder.html'),
  controller: FolderController
};
