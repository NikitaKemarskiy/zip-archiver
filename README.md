# zip-archiver

Package that you can use to zip items and folders with their internal files.

## Using

Firstly you should clone this repository in your application using git clone command.

```
git clone https://github.com/NikitaKemarskiy/zip-archiver.git
```
Then you should require it in your application. This module is a function with three arguments.

```javascript
const zip_archiver = require('./zip-archiver'); // Requiring zip-archiver package

let archive_path = './out.zip'; // Path to the output archive
let items_path = './'; // Path to the items needed to be zipped
let items = ['item1', 'item2', 'folder1']; // Names of the items needed to be zipped

zip_archiver(items_path, items, archive_path).then(function(result) { // Creating a zip archive
	console.log(result);
});
```


