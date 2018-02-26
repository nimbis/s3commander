export class Path {
  /**
   * Components between separators.
   */
  private parts: string[];

  /**
   * Whether the path represents a folder.
   */
  private folder: boolean;

  /**
   * Create a new path.
   */
  constructor (path: string = '') {
    // split the path into components
    this.parts = path.split('/').filter(function(part: string) {
      return part.length > 0;
    });

    // detect if this path refers to a folder
    this.folder = (path.substring(path.length - 1) === '/');
  }

  /**
   * Get the file or folder name.
   */
  public name(): string {
    // corner case: root path
    if (this.parts.length === 0) {
      return '';
    }

    // last component name
    return this.parts[this.parts.length - 1];
  }

  /**
   * Check if this path refers to a folder.
   */
  public isFolder(): boolean {
    return this.folder;
  }

  /**
   * Get the string representation.
   */
  public toString(): string {
    // corner case: empty path
    if (this.parts.length === 0) {
      return '';
    }

    // determine the path string
    var uri = this.parts.join('/');
    if (this.folder) {
      return `${uri}/`;
    }

    return uri;
  }
}
