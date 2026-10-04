/** File name safe for every operating system, keeping the document title readable. */
export const fileName = (title: string, version: string, ext: string) =>
  `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()} v${version}.${ext}`;
