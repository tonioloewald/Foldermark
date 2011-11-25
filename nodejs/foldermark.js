var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var showdown = require('./lib/showdown');
var converter = new showdown.converter();

var config = {
	content : '/Users/tal/Sites/fmtest',
	site_name : 'folder.mark',
	css : [
		'/folder.mark/screen.css',
		'/folder.mark/print.css'
	],
	js : [
		'/folder.mark/lib/jquery.js',
		'/folder.mark/lib/av.js',
		'/folder.mark/lib/less.js'
	]
}

function render_error( err, msg ){
	if( msg == undefined ){
		msg = 'not specified';
	}
	console.log('Error: ' + msg );
	res.writeHead(500, {'Content-Type': 'text/plain' });
	res.end( 'Application Error' );
}

/*
	Adapted from:
	http://elegantcode.com/2011/04/06/taking-baby-steps-with-node-js-pumping-data-between-streams/
*/
function stream_response( res, file_path, content_type ){
	var readStream = fs.createReadStream(file_path);
	
	res.writeHead(200, {'Content-Type': content_type});
	readStream.on('data', function(data) {
		var flushed = res.write(data);
		// Pause the read stream when the write stream gets saturated
		if(!flushed)
				readStream.pause();
	});
	
	res.on('drain', function() {
		// Resume the read stream when the write stream gets hungry 
		readStream.resume();
	});
	
	readStream.on('end', function() {
		res.end();
	});
}

function render_response( res, file_path ){
	var text;
	var html;
	
	fs.readFile(file_path, 'utf8', function (err, data) {
		if (err) {
			render_error(err, 'could not render ' + file_path);
		} else {
			html = converter.makeHtml( data );
			res.writeHead(200, {'Content-Type': 'text/html' });
			res.end( html );
		}
	});	
}

// given a page path, render the page
function render_response_page( res, path ){
	var path_parts = path.split('/');
	if( path_parts[0] == '' ){
		path_parts.shift();
	}
	if( path_parts.length && path_parts[ path_parts.length - 1 ] == '' ){
		path_parts.pop();
	}
	var page_spec = {
		path_parts : path_parts,
		actual_path : config.content,
		title : config.site_name,
		css : config.css,
		js : config.js,
		content : [],
		children : []
	}
	assemble_page( res, page_spec );
}

function part_to_title( file ){
	return file.replace(/^\d+_/,'').replace(/[\s_]/,' ');
}

function part_to_url( file ){
	return file.replace(/^\d+_/,'').replace(/[\s_]/,'-').toLowerCase();
}

function assemble_page( res, page_spec ){
	var folder;
	var new_path = false;
	var file, file_path, stat, name;

	if( page_spec.path_parts.length == 0 ){
		fs.readdir( page_spec.actual_path, function( err, files ){
			if( err ){
				render_error( err, 'could not render ' + page_spec.actual_path );
			} else {
				var i;
				var html = '<!doctype html><html><head><title>' + page_spec.title + '</title>';
				for( i = 0; i < files.length; i++ ){
					file = files[i];
					if( file.substr(0,1) == '.' ){
						continue;
					}
					file_path = path.join( page_spec.actual_path, file);
					stat = fs.statSync( file_path );
					if( stat.isDirectory() ){
						// collect children
						page_spec.children.push( file );
					} else {
						switch( path.extname( file ) ){
							case '.js':
								page_spec.js.push( file_path );
								break;
							case '.css':
								page_spec.css.push( file_path );
								break;
							case '.txt':
							case '.markdown':
							case '.md':
								page_spec.content.push( converter.makeHtml( fs.readFileSync( file_path, 'utf8' ) ) );
								break;
							case '.html':
								page_spec.content.push( fs.readFileSync( file_path, 'utf8' ) );
								break;
							default:
						}
					}
				}
				for( i = 0; i < page_spec.css.length; i++ ){
					html += "<link rel='stylesheet/less' type='text/css' media='print' href='" + page_spec.css[i] +"'>";
				}
				html += '</head><body>';
				html += '<ul>';
				for( i = 0; i < page_spec.children.length; i++ ){
					file = page_spec.children[i];
					html += '<li><a href="' + part_to_url( file ) + '">' 
						+ part_to_title( file ) + '</a></li>';
				}
				html += '</ul>';
				for( i = 0; i < page_spec.content.length; i++ ){
					html += page_spec.content[i];
				}
				for( i = 0; i < page_spec.js.length; i++ ){
					html += "<script type='text/javascript' src='" + page_spec.js[i]; + '"></script>';
				}
				html += '</body></html>';
				res.writeHead(200, {'Content-Type': 'text/html'});
				res.end( html );
			}
		} );
	} else {
		folder = page_spec.path_parts.shift();
		fs.readdir( page_spec.actual_path, function( err, files ){
			if( err ){
				render_error( err, 'could not assemble ' + page_spec.actual_path );
			} else {
				files.sort();
				for( var i = 0; i < files.length; i++ ){
					file = files[i];
					if( file.substr(0,1) == '.' ){
						continue;
					}
					file_path = path.join( page_spec.actual_path, file );
					stat = fs.statSync( file_path );
					if( stat.isDirectory() ){
						name = part_to_url( file );
						if( name == folder ){
							new_path = file_path;				
							if( page_spec.path_parts.length == 0 ){
								page_spec.title = part_to_title( file );
							}
						}
					} else {
						// can implement js and css inheritance here later
						switch( path.extname( file ) ){
							case '.js':
								break;
							case '.css':
								break;
							default:
						}
					}
				}
				if( new_path ){
					page_spec.actual_path = new_path;
					assemble_page( res, page_spec );
				} else {
					res.writeHead(404, {'Content-Type': 'text/plain'});
					res.end( 'File Not Found (' + page_spec.actual_path + '/' + folder + ')' );
				}
			}
		} );
	}
}

function handle_file_request( res, file_path, file_type ){
	switch( file_type ){
		case '.pdf':
			stream_response( res, file_path, 'application/pdf' );
			break;
		case '.zip':
			stream_response( res, file_path, 'application/zip' );
			break;
		case '.json':
			stream_response( res, file_path, 'application/json' );
			break;
		case '.js':
			stream_response( res, file_path, 'application/javascript' );
			break;
		case '.html':
			stream_response( res, file_path, 'text/html' );
			break;
		case '.txt':
			stream_response( res, file_path, 'text/plain' );
			break;
		case '.md':
		case '.markdown':
			render_response( res, file_path );
			break;
		case '.jpg':
			stream_response( res, file_path, 'image/jpeg' );
			break;
		case '.gif':
			stream_response( res, file_path, 'image/gif' );
			break;
		case '.png':
			stream_response( res, file_path, 'image/png' );
			break;
		case '.mp4':
			stream_response( res, file_path, 'video/mp4' );
			break;
		case '.mp3':
			stream_response( res, file_path, 'audio/mpeg' );
			break;
		case '.mov':
		case '.qt':
			stream_response( res, file_path, 'video/quicktime' );
			break;
		case '.css':
			stream_response( res, file_path, 'text/css' );
			break;
		default:
			res.writeHead(400, {'Content-Type': 'text/plain'});
			res.end( 'Bad Request (' + file_type + ')' );
	}
}

http.createServer( function( req, res ){
	var request_url = url.parse( req.url, true );
	var request_path = path.join( config.content, path.normalize( request_url.pathname ) );
	var request_type = path.extname( request_path );
	if( request_type == '' ){
		/*
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end( request_url.pathname );
		*/
		render_response_page( res, request_url.pathname );
	} else {
		path.exists( request_path, function( found ){
			if( found ){
				handle_file_request( res, request_path, request_type );
			} else {
				res.writeHead(404, {'Content-Type': 'text/plain'});
				res.end( 'File Not Found (' + request_path + ')' );
			}
		} );
	}
}).listen(8124, '127.0.0.1');
console.log('Server running at http://127.0.0.1:8124/');

