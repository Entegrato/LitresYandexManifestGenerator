const { src, dest } = require('gulp');
const { task, series, parallel } = require('gulp');
const through2 = require('through2');
const fs = require('fs');
const del = require('del');
let manifest = {}; // Глобально храним собираемый манифест
let jsLinks = [];
let cssLinks = [];
let imagesLinks = [];

/** Удаляем старый манифест в папке out если он существует */
task('prepare', function (callback) {
	console.log(fs.existsSync('./out'))
	if (fs.existsSync('./out')) {
		createSubdirectories();
	} else {
		src('./out', {allowEmpty: true})
		.on('data', function(file) {
			del('out', {force:true})
		})
		.on('end', function() {
			createSubdirectories();
		});
	}

	/** Функция создания структуры директорий в out */
	function createSubdirectories() {
		let dir = './out';
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
	
		// Создадим папку out, если ее нет
		let dir2 = './out/temp';
		if (!fs.existsSync(dir2)) {
			fs.mkdirSync(dir2);
		}

		callback();
	}
});

/** Парсим манифест из src, будем его апдейтить */
task('parse-initial-manifest', function(callback) {
	fs.readFile('./src/manifest.json', 'utf8', function(err, content) {
		if (err) console.error('Не удалось прочитать изначальный манифест. Проверьте src/manifest.json. Ошибка: ', err);

		manifest = JSON.parse(content);
		callback();
	});
});

/** Парсим манифест из src, будем его апдейтить */
task('parse-js', function(callback) {
	// Удалим файл с JS путями
	if (fs.existsSync('./out/temp/js-paths.txt')) {
		fs.unlink('./out/temp/js-paths.txt', function(err) { if (err) console.log(err); });	
	}

	// Ищем все JS файлы и перерабатываем
	src('./src/static/litres/**/*.js')
		.on('data', function(file) {
			fs.appendFile("./out/temp/js-paths.txt", file.path + "\n", function(error){
				if (error) console.log('Не удалось записать путь файла в дебаг: ', error); // если возникла ошибка
				// console.log(file.path);
			});
		})
		.on('end', function() {
			callback();
		});
});

/** Парсим манифест из src, будем его апдейтить */
task('parse-css', function(callback) {
	// Удалим файл с JS путями
	if (fs.existsSync('./out/temp/css-paths.txt')) {
		fs.unlink('./out/temp/css-paths.txt', function(err) { if (err) console.log(err); });
	}

	// Ищем все JS файлы и перерабатываем
	src('./src/static/litres/**/*.css')
		.on('data', function(file) {
			fs.appendFile("./out/temp/css-paths.txt", file.path + "\n", function(error){
				if (error) console.log('Не удалось записать путь файла в дебаг: ', error); // если возникла ошибка
				// console.log(file.path);
			});
		})
		.on('end', function() {
			callback();
		});
});

/** Парсим манифест из src, будем его апдейтить */
task('parse-images', function(callback) {
	// Удалим файл с JS путями
	if (fs.existsSync('./out/temp/images-paths.txt')) {
		fs.unlink('./out/temp/images-paths.txt', function(err) { if (err) console.log(err); });	
	}

	// Ищем все JS файлы и перерабатываем
	src('./src/static/litres/**/*.+(png|jpg|gif|svg)')
		.on('data', function(file) {
			fs.appendFile("./out/temp/images-paths.txt", file.path + "\n", function(error){
				if (error) console.log('Не удалось записать путь файла в дебаг: ', error); // если возникла ошибка
				// console.log(file.path);
			});
		})
		.on('end', function() {
			callback();
		});
});

/**  */
task('js-to-global', function(callback) {
	fs.readFile('./out/temp/js-paths.txt', 'utf8', function(err, content) {
		if (err) console.error('Не удалось прочитать js-paths. Ошибка: ', err);
		jsLinks = content.match(new RegExp(/\/static\/litres\/.*/gm));
		callback();
	});
});

/**  */
task('css-to-global', function(callback) {
	fs.readFile('./out/temp/css-paths.txt', 'utf8', function(err, content) {
		if (err) console.error('Не удалось прочитать css-paths. Ошибка: ', err);
		cssLinks = content.match(new RegExp(/\/static\/litres\/.*/gm));
		callback();
	});
});

/**  */
task('images-to-global', function(callback) {
	fs.readFile('./out/temp/images-paths.txt', 'utf8', function(err, content) {
		if (err) console.error('Не удалось прочитать images-paths. Ошибка: ', err);
		imagesLinks = content.match(new RegExp(/\/static\/litres\/.*/gm));
		callback();
	});
});

/** Сохраняем созданный манифест в out папку */
task('save-final-namifest', function(callback) {
	// Каждое обновление будем вписывать дату как версию манифеста
	manifest.yandex.app_version = new Date();

	// Склеим массивы найденные через RegExp и запишем в массив ресурсов в манифесте
	let finalLinks = [...jsLinks, ...cssLinks, ...imagesLinks]
	manifest.yandex.cache.resources = finalLinks;

	fs.writeFile('./out/manifest.json', JSON.stringify(manifest, null, '\t'), 'utf-8', function(err) {
		if (err) console.error('Не удалось записать конечный manifest.json. Ошибка: ', err);
		callback();
	});
});




task('default', series(
	'prepare',
	'parse-initial-manifest',
	'parse-js',
	'js-to-global',
	'parse-css',
	'css-to-global',
	'parse-images',
	'images-to-global',
	'save-final-namifest'
));