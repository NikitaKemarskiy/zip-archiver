# zip-archiver

Package that you can use to zip items and folders with their internal files.

## Using

```
const zip-archiver = require('zip-archiver'); // Requiring zip-archiver package

let archive_path = './out.zip'; // Path to the output archive
let items_path = './'; // Path to the items needed to be zipped
let items = ['item1', 'item2', 'folder1']; // Names of the items needed to be zipped

zip-archiver(items_path, items, archive_path).then(function(result) { // Creating a zip archive
	console.log(result);
});
```


