// Modules
const jszip = require('jszip');
const path = require('path');
const fs = require('fs');
const util = require('util');

// Promisified functions
const stat = util.promisify(fs.stat);
const readDir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

// Functions
const itemsProcessing = { // Object that contains functions connected with proccesing the items (sorting, parsing etc.)

	// Function that sorts the items in the special order (folders first, files second)
	sortItems: function(itemsArray) { 

		let itemsArraySorted = []; // Array for items parsed in the special order

		for (let i = 0; i < itemsArray.length; i++) { // Filling the parsed items array -> inputing folders firstly
			if (itemsArray[i].type === "folder") { // If item's type is a folder -> input
				itemsArraySorted.push(itemsArray[i]);
			}
		}

		for (let i = 0; i < itemsArray.length; i++) { // Filling the parsed items array -> inputing files secondly
			if (itemsArray[i].type === "file") { // If item's type is a file -> input
				itemsArraySorted.push(itemsArray[i]);
			}
		}

		return itemsArraySorted; // Returning array of sorted items
	},

	// Function that parses files in a directory into an array with objects
	parseItems: async function(itemsPath, items) { 

		const itemsArrayFilled = async function() { // Promise function for filling the items array 

			let itemsArray = []; // Array for items
			let asyncCallsCounter = 0; // Variable that contains a number of async calls into the loop

			for (let i = 0; i < items.length; i++) {

				let itemPath = path.join(itemsPath, items[i]); // Current item path

				try {
					let stats = await stat(itemPath);

					if (stats.isDirectory()) { // Item is a folder
						itemsArray.push({
							type: 'folder',
							name: items[i]
						});
					} else if (stats.isFile()) { // Item is a file
						itemsArray.push({
							type: 'file',
							name: items[i]
						});
					}
					
					asyncCallsCounter++; // Incrementing an amount of async calls

					if (asyncCallsCounter >= items.length) { // If it's the last file -> return array with items
						return itemsArray;
					}
				} catch(error) {
					console.error(`Error: ${error.message}`);
				}
			}
		}

		// After getting all the files stats -> sort it (folders first, files second)
		let itemsArray = await itemsArrayFilled();
		itemsArraySorted = itemsProcessing.sortItems(itemsArray);
		return itemsArraySorted;
	}
};

const itemsCounting = { // Object that contains functions connected with counting the items

	// Function that counts a number of items to zip (including items inside the subfolders)
	countItemsToZip: async function(itemsPath, items) { 

		let itemsToZip = 0; // A number of items to zip
		let directories = []; // Array for pushing directories to count items inside of them later 

		if (items.length === 0) { // If there're no items -> return 0
			return 0; 
		} else { // If items array isn't empty -> parse these items and count their number

			let itemsParsed = await itemsProcessing.parseItems(itemsPath, items);

			for (let i = 0; i < itemsParsed.length; i++) {

				if (itemsParsed[i].type === 'folder') { // Item is a folder -> push it into the directories array
					directories.push(itemsParsed[i].name);
				}

				itemsToZip++; // Incrementing the number of items to zip
			}

			if (directories.length > 0) { // If directories are among the items -> count items which are inside them
				let itemsInDirectories = await itemsCounting.countItemsInDirectories(itemsPath, directories);
				itemsToZip += itemsInDirectories;
				return itemsToZip;
			} else { // If there're no directories among the items -> return current number of items to zip
				return itemsToZip;
			}
		}
	},

	// Function that counts a number of items inside folders to zip
	countItemsInDirectories: async function(directoriesPath, directories) { 

		let asyncCallsCounter = 0; // Variable that contains a number of async calls into the loop
		let itemsInDirectories = 0; // Variable that contains a number of items inside the folders to zip
			
		for (let i = 0; i < directories.length; i++) {
			let directoryPath = path.join(directoriesPath, directories[i]); // Current folder path
			
			try {
				let directoryItems = await readDir(directoryPath); // Reading the folder
				if (directoryItems.length === 0) { // Directory is empty
					asyncCallsCounter++; // Incrementing an amount of async calls
					
					// If it's the last needed call -> return a number of items inside the folders
					if (asyncCallsCounter >= directories.length) { 
						return itemsInDirectories;
					}
				} else {
					// Calling count items to zip functions inside the current folder
					let itemsToZip = await itemsCounting.countItemsToZip(directoryPath, directoryItems);
					
					itemsInDirectories += itemsToZip; // Incrementing a number of items inside the folder to zip
					asyncCallsCounter++; // Incrementing an amount of async calls
					
					// If it's the last needed call -> return a number of items inside the folders
					if (asyncCallsCounter >= directories.length) { 
						return itemsInDirectories;
					}
				}
			} catch(error) {
				console.error(`Error: ${error.message}`);
			}
		}
	}
};

const zipProcessing = { // Object that contains functions connected with processing zip archive

	// Function that generates a zip archive
	generateZip: function(zip, archivePath) { 
		return new Promise(function(resolve, reject) {
			zip.generateNodeStream({ type:'nodebuffer', streamFiles:true }) // Creating readable stream of zip 
				.pipe(fs.createWriteStream(archivePath)) // Piping this stream to writable
				.on('finish', function () { // Archive was created
			    	resolve(archivePath);
				});	
		});
	},

	// Function that adds files inside some folder to archive
	addDirectoryToZip: async function(directory, directoryPath, items) { 

		let asyncCallsCounter = 0; // Variable that contains a number of async calls into the loop

		if (items === undefined) { // If items aren't passed -> add all the items inside the directory to zip archive

			try {
				let directoryItems = await readDir(directoryPath); // Reading the folder

				if (directoryItems.length === 0) { // If this folder is empty -> return empty directory
					return {
						directory,
						asyncCallsCounter
					};
				} else {
					// Calling count items to zip function to get a number of async calls
					let itemsToZip = await itemsCounting.countItemsToZip(directoryPath, directoryItems);
					let itemsParsed = await itemsProcessing.parseItems(directoryPath, directoryItems);						

					for (let i = 0; i < itemsParsed.length; i++) {

						let itemPath = path.join(directoryPath, itemsParsed[i].name); // File path

						if (itemsParsed[i].type === 'file') { // Item is a file

							try {
								let buffer = await readFile(itemPath); // Reading a file from the items array
								directory.file(itemsParsed[i].name, buffer, { binary: true }); // Inputing file into the zip archive

								asyncCallsCounter++; // Incrementing an amount of async calls

								if (asyncCallsCounter >= itemsToZip) { // If it's the last needed call -> return a new directory
									return {
										directory,
										asyncCallsCounter
									};
								}
							} catch(error) {
								console.error(`Error: ${error.message}`);
							}
						} else { // Item is a folder

							let newDirectory = directory.folder(itemsParsed[i].name);

							let createdDirectory = await zipProcessing.addDirectoryToZip(newDirectory, itemPath); 
							newDirectory = createdDirectory.directory;
							asyncCallsCounter += createdDirectory.asyncCallsCounter + 1;

							if (asyncCallsCounter >= itemsToZip) { // If it's the last needed call -> save a zip archive to the storage
								return {
									directory,
									asyncCallsCounter
								};
							}
						}
					}
				}
			} catch(error) {
				console.error(`Error: ${error.message}`);
			}
		} else { // Items were passed -> add only these items inside zip archive

			// Calling count items to zip function to get a number of async calls
			let itemsToZip = await itemsCounting.countItemsToZip(directoryPath, items);
			let itemsParsed = await itemsProcessing.parseItems(directoryPath, items); // Parsing items array

			for (let i = 0; i < itemsParsed.length; i++) {

				let itemPath = path.join(directoryPath, itemsParsed[i].name); // Current file path

				if (itemsParsed[i].type === 'file') { // Item is a file

					try {
						let buffer = await readFile(itemPath);
						directory.file(itemsParsed[i].name, buffer, { binary: true }); // Inputing file into the zip archive

						asyncCallsCounter++; // Incrementing an amount of async calls

						if (asyncCallsCounter >= itemsToZip) { // If it's the last needed call -> save a zip archive to the storage
							return {
								directory,
								asyncCallsCounter
							};
						}
					} catch(error) {
						console.error(`Error: ${error.message}`);	
					}
				} else { // Item is a folder

					let newDirectory = directory.folder(itemsParsed[i].name); // Inputing folder into the zip archive
					let createdDirectory = await zipProcessing.addDirectoryToZip(newDirectory, itemPath); // Reading all the files inside this folder and inputing them into it
					
					newDirectory = createdDirectory.directory;
					asyncCallsCounter += createdDirectory.asyncCallsCounter + 1; // Increasing an amount of async calls

					if (asyncCallsCounter >= itemsToZip) { // If it's the last needed call -> create a zip archive to the storage
						return {
							directory,
							asyncCallsCounter
						};
					}
				}
			}
		}

	},

	// Export function that initializes and creates a zip archive
	writeZip: async function(itemsPath, items, archivePath) { 

		let asyncCallsCounter = 0; // Variable that contains a number of async calls into the loop
		let zip = new jszip();

		let createdDirectory = await zipProcessing.addDirectoryToZip(zip, itemsPath, items); // Calling add directory to zip function for the items folder
		zip = createdDirectory.directory;

		let zipCreatedPath = await zipProcessing.generateZip(zip, archivePath);
		return zipCreatedPath;
	}
};

// Exports
module.exports = zipProcessing.writeZip;
