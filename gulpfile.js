const { src, dest } = require('gulp');
const { task, series, parallel } = require('gulp');
const fs = require('fs');
const del = require('del');
const axios = require('axios');

let manifest = {}; // Глобально храним собираемый манифест
let jsLinks = [];
let cssLinks = [];
let imagesLinks = [];
// Общий массив ссылок перед запросами на сервер
let mergedLinks = [];
// Это мы уже будем сохранять в манифест, проверенные файлы статики
let finalLinks = [];

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

/** Парсим все JS файлы */
task('parse-js', function(callback) {
	// Удалим файл с JS путями
	if (fs.existsSync('./out/temp/js-paths.txt')) {
		fs.unlink('./out/temp/js-paths.txt', function(err) { if (err) console.log(err); });	
	}

	// Ищем все JS файлы и перерабатываем
	src(['./src/static/pda_2.0/**/*.js', './src/static/litres/**/*.js'])
		.on('data', function(file) {
			fs.appendFile("./out/temp/js-paths.txt", file.path + "\n", function(error){
				if (error) console.log('Не удалось записать путь файла в дебаг: ', error); // если возникла ошибка
			});
		})
		.on('end', function() {
			callback();
		});
});

/** Парсим все CSS файлы */
task('parse-css', function(callback) {
	// Удалим файл с JS путями
	if (fs.existsSync('./out/temp/css-paths.txt')) {
		fs.unlink('./out/temp/css-paths.txt', function(err) { if (err) console.log(err); });
	}

	// Ищем все JS файлы и перерабатываем
	src(['./src/static/pda_2.0/**/*.css', './src/static/litres/**/*.css'])
		.on('data', function(file) {
			fs.appendFile("./out/temp/css-paths.txt", file.path + "\n", function(error){
				if (error) console.log('Не удалось записать путь файла в дебаг: ', error); // если возникла ошибка
			});
		})
		.on('end', function() {
			callback();
		});
});

/** Парсим все картинки */
task('parse-images', function(callback) {
	// Удалим файл с JS путями
	if (fs.existsSync('./out/temp/images-paths.txt')) {
		fs.unlink('./out/temp/images-paths.txt', function(err) { if (err) console.log(err); });	
	}

	// Ищем все JS файлы и перерабатываем
	src(['./src/static/pda_2.0/**/*.+(png|jpg|gif|svg)', './src/static/litres/**/*.+(png|jpg|gif|svg)'])
		.on('data', function(file) {
			fs.appendFile("./out/temp/images-paths.txt", file.path + "\n", function(error){
				if (error) console.log('Не удалось записать путь файла в дебаг: ', error); // если возникла ошибка
			});
		})
		.on('end', function() {
			callback();
		});
});

/** Сохраняем в глобалку ноды массив JS */
task('js-to-global', function(callback) {
	fs.readFile('./out/temp/js-paths.txt', 'utf8', function(err, content) {
		if (err) console.error('Не удалось прочитать js-paths. Ошибка: ', err);
		let relativeJsLinks = content.match(new RegExp(/\/static\/?(litres|pda_2.0)\/.*/gm));
		relativeJsLinks.forEach(element => {
			jsLinks.push('https://www.litres.ru' + element);
		});
		callback();
	});
});

/** Сохраняем в глобалку ноды массив CSS */
task('css-to-global', function(callback) {
	fs.readFile('./out/temp/css-paths.txt', 'utf8', function(err, content) {
		if (err) console.error('Не удалось прочитать css-paths. Ошибка: ', err);
		let relativeCssLinks = content.match(new RegExp(/\/static\/?(litres|pda_2.0)\/.*/gm));
		relativeCssLinks.forEach(element => {
			cssLinks.push('https://www.litres.ru' + element);
		});
		callback();
	});
});

/** Сохраняем в глобалку ноды массив картинок */
task('images-to-global', function(callback) {
	fs.readFile('./out/temp/images-paths.txt', 'utf8', function(err, content) {
		if (err) console.error('Не удалось прочитать images-paths. Ошибка: ', err);
		let relativeCssLinks = content.match(new RegExp(/\/static\/?(litres|pda_2.0)\/.*/gm));
		relativeCssLinks.forEach(element => {
			imagesLinks.push('https://www.litres.ru' + element);
		});
		callback();
	});
});

/** Сводим весь спаршенный массив в один, чтобы далее запросить по нему все файлы статики на сервере и проверить что они есть */
task('merge-finded-links', function(callback) {
	// Склеим массивы найденные через RegExp и запишем в массив непроверенных на 404 ресурсов
	mergedLinks = [...jsLinks, ...cssLinks, ...imagesLinks]
	callback();
});

/** Чекаем рекурсивно каждый файл в предварительном списке, если 200 0 добавляем в финальный список. Массив кончится - отдадим управление новому таску */
task('check-status-on-server', function(callback) {
	var maxCount = [...mergedLinks].length;
	var counter = 0;

	requestFileRecirsive([...mergedLinks]); // Важно сделать копию массива иначе будем из JSON убирать итемы

	function requestFileRecirsive(items, sid) {
		if (items.length === 0) {
			console.log('Все Properties сохранены в базе.');
			return callback();
		}

		var item = items.pop();

		axios({
			url: item,
			method: 'GET',
			responseType: 'text'
		})
		.then(function (response) {
			counter++;
			console.log(counter + ' / ' + maxCount + ' Добавлен: ', item);

			finalLinks.push(item); // Добавим в финальынй массив
			requestFileRecirsive(items);
		})
		.catch(function (error) {
			counter++;
			console.log(counter + ' / ' + maxCount + ' НЕ добавлен итем: ', item, error.response.status, error.response.statusText);

			requestFileRecirsive(items);
		});
	}
});

/** Сохраняем созданный манифест в out папку */
task('save-final-manifest', function(callback) {
	// Каждое обновление будем вписывать дату как версию манифеста
	let date = new Date();
	manifest.yandex.app_version = date.toString().match(new RegExp(/\d/gm)).join('').substring(2,11);
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
	// 'parse-images',
	// 'images-to-global',
	'merge-finded-links',
	'check-status-on-server',
	'save-final-manifest'
));
