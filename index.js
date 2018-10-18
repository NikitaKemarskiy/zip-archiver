// Modules
const jszip = require('jszip');
const fs = require('fs');
const path = require('path');

// Functions
const items_processing = { // Object that contains functions connected with proccesing the items (sorting, parsing etc.)

	sort_items: function(items_array) { // Function that sorts the items in the special order (folders first, files second)

		let items_array_sorted = []; // Array for items parsed in the special order

		for (let i = 0; i < items_array.length; i++) { // Filling the parsed items array -> inputing folders firstly
			if (items_array[i].type === "folder") { // If item's type is a folder -> input
				items_array_sorted.push(items_array[i]);
			}
		}

		for (let i = 0; i < items_array.length; i++) { // Filling the parsed items array -> inputing files secondly
			if (items_array[i].type === "file") { // If item's type is a file -> input
				items_array_sorted.push(items_array[i]);
			}
		}

		return items_array_sorted; // Returning array of sorted items
	},

	parse_items: function(items_path, items) { // Function that parses files in a directory into an array with objects

		let items_array = []; // Array for items
		let async_calls_counter = 0; // Variable that contains a number of async calls into the loop

		return new Promise(function(resolve, reject) {

			const items_array_filled = function() { // Promise function for filling the items array 

				return new Promise(function(resolve, reject) {

					for (let i = 0; i < items.length; i++) {

						let item_path = path.join(items_path, items[i]); // Current item path

						fs.stat(item_path, function(error, stats) { // Getting info about current item

							if (error) {
								console.error(`Error: ${error.message}`);
							} else {

								if (stats.isDirectory()) { // Item is a folder
									items_array.push({
										type: 'folder',
										name: items[i]
									});
								} else if (stats.isFile()) { // Item is a file
									items_array.push({
										type: 'file',
										name: items[i]
									});
								}
								
								async_calls_counter++; // Incrementing an amount of async calls

								if (async_calls_counter >= items.length) { // If it's the last file -> resolving the promise
									resolve(items_array);
								}
							}
						});
					}
				});
			}

			items_array_filled().then(function(items_array) { // After getting all the files stats -> sort it (folders first, files second)
				items_array_sorted = items_processing.sort_items(items_array);
				resolve(items_array_sorted);
			});
		});
	}
};

const items_counting = { // Object that contains functions connected with counting the items

	count_items_to_zip: function(items_path, items) { // Function that counts a number of items to zip (including items inside the subfolders)

		let items_to_zip = 0; // A number of items to zip
		let directories = []; // Array for pushing directories to count items inside of them later 

		return new Promise(function(resolve, reject) {

			if (items.length === 0) { // If there're no items -> resolve 0
				resolve(0); 
			} else { // If items array isn't empty -> parse these items and count their number

				items_processing.parse_items(items_path, items).then(function(items_parsed) { // Parse array of items

					for (let i = 0; i < items_parsed.length; i++) {

						if (items_parsed[i].type === 'folder') { // Item is a folder -> push it into the directories array
							directories.push(items_parsed[i].name);
						}

						items_to_zip++; // Incrementing the number of items to zip
					}

					if (directories.length > 0) { // If directories are among the items -> count items which are inside them
						
						items_counting.count_items_in_directories(items_path, directories).then(function(result){
							items_to_zip += result;
							resolve(items_to_zip);
						});
					} else { // If there're no directories among the items -> resolve current number of items to zip
						resolve(items_to_zip);
					}

				});
			}
		});
	},

	count_items_in_directories: function(directories_path, directories) { // Function that counts a number of items inside folders to zip

		let async_calls_counter = 0; // Variable that contains a number of async calls into the loop
		let items_in_directories = 0; // Variable that contains a number of items inside the folder to zip

		return new Promise(function(resolve, reject) {

			for (let i = 0; i < directories.length; i++) {

				let directory_path = path.join(directories_path, directories[i]); // Current folder path

				fs.readdir(directory_path, function(error, directory_items) { // Reading this folder
					if (error) {
						console.error(`Error: ${error.message}`);
					} else {
						items_counting.count_items_to_zip(directory_path, directory_items).then(function(result) { // Calling count items to zip functions inside the current folder

							items_in_directories += result; // Incrementing a number of items inside the folder to zip
							async_calls_counter++; // Incrementing an amount of async calls
							
							if (async_calls_counter >= directories.length) { // If it's the last needed call -> save a zip archive to the storage
								resolve(items_in_directories);
							}
						});
					}
				}); 
			}
		});
	}
};

const zip_processing = { // Object that contains functions connected with processing zip archive

	generate_zip: function(zip, archive_name) { // Function that generates a zip archive
	
		return new Promise(function(resolve, reject) {

			zip.generateNodeStream({ type:'nodebuffer', streamFiles:true }) // Creating readable stream of zip 
				.pipe(fs.createWriteStream(archive_name)) // Piping this stream to writable
				.on('finish', function () { // Archive was created
			    	resolve(`${archive_name} was written.`);
				});	
		});
	},

	add_to_zip_directory: function(directory_path, directory) { // Function that adds files inside some folder to archive

		let async_calls_counter = 0; // Variable that contains a number of async calls into the loop

		return new Promise(function(resolve, reject) {

			fs.readdir(directory_path, function(error, directory_items) { // Reading the folder
				
				if (error) {
					console.error(`Error: ${error.message}`);
				} else {

					items_counting.count_items_to_zip(directory_path, directory_items).then(function(items_to_zip) { // Calling count items to zip function to get a number of async calls

						items_processing.parse_items(directory_path, directory_items).then(function(items_parsed) {

							for (let i = 0; i < items_parsed.length; i++) {

								let item_path = path.join(directory_path, items_parsed[i].name); // File path

								if (items_parsed[i].type === 'file') { // Item is a file

									fs.readFile(item_path, 'utf8', function(error, buffer) { // Read file from items array

										if (error) {
											console.error(`Error: ${error.message}`);
										} else {
											directory.file(items_parsed[i].name, buffer); // Inputing file into the zip archive

											async_calls_counter++; // Incrementing an amount of async calls

											if (async_calls_counter >= items_to_zip) { // If it's the last needed call -> resolve a new directory
												resolve({
													directory,
													async_calls_counter
												});
											}
										}
									});
								} else { // Item is a folder

									let new_directory = directory.folder(items_parsed[i].name);

									zip_processing.add_to_zip_directory(item_path, new_directory).then(function(result) {

										new_directory = result.directory;
										async_calls_counter += result.async_calls_counter + 1;

										if (async_calls_counter >= items_to_zip) { // If it's the last needed call -> save a zip archive to the storage
											resolve({
												directory,
												async_calls_counter
											});
										}
									});
								}
							}
						});
					});
				}
			});
		});
	},

	write_zip: function(items_path, items, archive_name) { // Function that creates zip archive

		let async_calls_counter = 0; // Variable that contains a number of async calls into the loop
		let zip = new jszip();

		return new Promise(function(resolve, reject) {

			items_counting.count_items_to_zip(items_path, items).then(function(items_to_zip) { // Calling count items to zip function to get a number of async calls

				items_processing.parse_items(items_path, items).then(function(items_parsed){ // Parsing items array

					for (let i = 0; i < items_parsed.length; i++) {

						let item_path = path.join(items_path, items_parsed[i].name); // Current file path

						if (items_parsed[i].type === 'file') { // Item is a file

							fs.readFile(item_path, 'utf8', function(error, buffer) { // Read file from items array
								
								if (error) {
									console.error(`Error: ${error.message}`);
								} else {

									zip.file(items_parsed[i].name, buffer); // Inputing file into the zip archive

									async_calls_counter++; // Incrementing an amount of async calls

									if (async_calls_counter >= items_to_zip) { // If it's the last needed call -> save a zip archive to the storage
										zip_processing.generate_zip(zip, archive_name).then(function(result) {
											resolve(result);
										});
									}
								}
							});
						} else { // Item is a folder

							let directory = zip.folder(items_parsed[i].name); // Inputing folder into the zip archive

							zip_processing.add_to_zip_directory(item_path, directory).then(function(result) { // Reading all the files inside this folder and inputing them into it

								directory = result.directory;
								async_calls_counter += result.async_calls_counter + 1; // Increasing an amount of async calls

								if (async_calls_counter >= items_to_zip) { // If it's the last needed call -> create a zip archive to the storage
									zip_processing.generate_zip(zip, archive_name).then(function(result) {
										resolve(result);
									});
								}
							});
						}
					}
				});
			});
		});
	}
};

// Export
module.exports = zip_processing.write_zip;
