import {File} from './../common/File';
import {IFileVersion} from './../common/IFileVersion';

export class FileController {
  /**
   * Dependencies we want passed to the constructor.
   * @see http://docs.angularjs.org/guide/di
   */
  public static $inject = [
    '$rootScope'
  ];

  /**
   * File object. Passed in as component binding.
   */
  public file: File;

  /**
   * Whether the parent bucket is versioned. Passed in as component binding.
   */
  public versioned: boolean;

  /**
   * File versions.
   */
  public versions: IFileVersion[];

  /**
   * Flag used to indicate a background operation is running.
   */
  public working: boolean;

  /**
   * Show file versions.
   */
  public showVersions: boolean;

  /**
   * Create a file controller instance.
   */
  constructor(private $rootScope: ng.IScope) {
    this.versions = [];
    this.working = false;
    this.showVersions = false;
  }

  /**
   * Toggle showing file versions.
   */
  public toggleVersions() {
    // hide displayed file versions
    if (this.showVersions) {
      this.showVersions = false;
      return;
    }

    // load and display file versions
    this.working = true;
    this.onLoadVersions()
      .then((versions: IFileVersion[]) => {
        this.versions = versions.sort(this.compareFileVersions);
        this.showVersions = true;
      })
      .catch(() => {
        this.versions = [];
        this.showVersions = false;
      })
      .then(() => {
        this.working = false;
        this.$rootScope.$digest();
      });
  }

  /**
   * Load file versions. This is overriden by the component binding.
   */
  public onLoadVersions(): Promise<IFileVersion[]> {
    // overriden by binding but TypeScript requires we return something
    return new Promise(function (
      resolve: (data: IFileVersion[]) => void,
      reject: (error: Error) => void
    ) {
      reject(new Error('not implemented'));
    });
  }

  /**
   * Delete a file. This is overriden by the component binding.
   */
  public onDelete() {
    // overriden by binding
  }

  /**
   * Compare two file versions by the last modified date in newest order first.
   */
  private compareFileVersions(a: IFileVersion, b: IFileVersion) {
    if (a.lastModified < b.lastModified) {
      return 1;
    }

    if (a.lastModified > b.lastModified) {
      return -1;
    }

    return 0;
  }
}
