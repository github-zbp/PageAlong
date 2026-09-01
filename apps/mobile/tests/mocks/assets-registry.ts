export function registerAsset() {
  return 1;
}

export function getAssetByID() {
  return {
    fileSystemLocation: "/full/path/to/directory",
    httpServerLocation: "/assets/full/path/to/directory",
    scales: [1],
    fileHashes: ["md5"],
    name: "name",
    exists: true,
    type: "type",
    hash: "md5",
    uri: "uri",
    width: 1,
    height: 1
  };
}
