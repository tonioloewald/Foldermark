/**
	folder.mark 2.0
	===============
	
	Copyright (c)2011-13 Tonio Loewald
	
	Very much a work-in-progress
	
	To do
	-----
	
	* stop-inherit
	* refactoring
	    * Nav class
        * Page class
        * handle_file_request in its own file (with stream_response etc.)
        * error handlers in their own file
	
	Lower Priority
	--------------
	
	* document differences between php and node.js versions
	* deploy node.js version via heroku?
	* dropbox integration?
	
	Dependencies
	------------
	
	chokidar -- npm install chokidar
*/

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var config;
var nav_root;
var nav_tree_locks = 0;
var chokidar = require('chokidar');
var nav_watcher = false;

function fatal_error( res, err, msg ){
	if( msg == undefined ){
		msg = 'not specified';
	}
	console.log('Error', err, msg );
	res.writeHead(500, {'Content-Type': 'text/plain' });
	res.end( 'Application Error' );
}

function nonfatal_error( res, err_number, msg ){
    res.writeHead(err_number, {'Content-Type': 'text/plain'});
    res.end( msg );
}

function fuzz_path( path ){
    return path.replace(/[^\/]\w*_/g, '').replace(/\s+/g, '-').toLowerCase();
}

function part_sorter( A, B ){
    return A.path === B.path
           ? 0
           : ( A.path > B.path ? 1 : -1 );
}

function build_nav_tree( page, callback ){
    nav_tree_locks++;
    
    if( nav_watcher ){
        nav_watcher.close();
        nav_watcher = false;
    }
    
    function child_adder( child ){
        return function( err, stats ){
            if( err || !stats ){
                // TODO: error handling
            } else if ( stats.isDirectory() ){
                if( 
                    child.name.indexOf('.') > 0 
                    || child.name === 'images'
                ){
                    if( page.parts === undefined ){
                        page.parts = [];
                    }
                    page.parts.push( child );
                } else {
                    if( page.pages === undefined ){
                        page.pages = [];
                    }
                    page.pages.push( child );
                }
                build_nav_tree( child, callback );
            } else {
                if( page.parts === undefined ){
                    page.parts = [];
                }
                page.parts.push( child );
            }
	        nav_tree_cleanup( callback );
        };
    }

	fs.readdir( config.content_root + page.path, function( err, files ){
	    if( err || !files.length ){
	        nav_tree_cleanup( callback );
	        return;
	    }
	    
	    var i, file, child, path, full_path, path_name;
	    
	    files.sort();
	    for( i = 0; i < files.length; i++ ){
	        file = files[i];
	        if( file.substr(0,1) !== '.' ){
	            path = page.path + '/' + file;
	            full_path = config.content_root + path;
	            path_name = fuzz_path( path );
	            if( nav_root.name_list.indexOf( path_name ) === -1 ){
                    nav_root.path_list.push( full_path );
                    nav_root.name_list.push( fuzz_path( path ) );
	            } else {
	                console.warn( 'Duplicate path_name', path_name, full_path, nav_root.path_list[ nav_root.name_list.indexOf( path_name ) ] );
	            }
	            if( file !== 'fm.json' && file !== 'fm-sitemap.json' ){
                    child = {
                        path: path,
                        name: fuzz_path( file )
                    };
                    nav_tree_locks++;
                    fs.stat( full_path, child_adder( child ) );
	            }
	        }
	    }
	    
	    nav_tree_cleanup( callback );
	});
}

function save_text_file( path, content ){
    fs.writeFile( path, content, function(err) {
        if(err) {
            console.log(err);
        } else {
            // console.log(path, 'saved');
        }
    });
}

function write_page_data( page ){
    var i,
        parts = [];

    if( page.parts ){
        for( i = 0; i < page.parts.length; i++ ){
            parts.push( fuzz_path( page.parts[i].path ) );
            if( page.parts[i].parts ){
                save_text_file(config.content_root + page.parts[i].path + '/fm.json', JSON.stringify(page.parts[i].parts));
            }
        }
        save_text_file(config.content_root + page.path + '/fm.json', JSON.stringify(parts));
    }
    
    if( page.pages ){
        // inheritance -- figure out what needs to be inherited
        parts = [];
        for( i = page.parts.length - 1; i >= 0; i-- ){
            if( page.parts[i].path.match(/\.inherit(\.|$)/) !== null ){
                parts.push( page.parts[i] );
            }
        }
        for( i = 0; i < page.pages.length; i++ ){
            // inheritance -- if there's anything to inherit then pass it on
            if( parts.length ){
                if( page.pages[i].parts ){
                    page.pages[i].parts = page.pages[i].parts.concat(parts);
                } else {
                    page.pages[i].parts = [].concat(parts);
                }
                page.pages[i].parts.sort( part_sorter );
            }
            write_page_data( page.pages[i] );
        }
    }
}

function sitemap( node ){
    var i, 
        pages = [], 
        map = { 
            name: node.name,
            path: fuzz_path( node.path )
        };
    
    if( node.pages ){
        for( i = 0; i < node.pages.length; i++ ){
            pages.push( sitemap( node.pages[i] ) );
        }
        map.pages = pages;
    }
    
    return map;
}

function nav_tree_cleanup( callback ){
    nav_tree_locks--;
    
    if( nav_tree_locks === 0 ){
        console.log( "Nav Tree Built" );
        // console.log( JSON.stringify( nav_root, false, 2) );
        if( typeof callback === 'function' ){
            callback();
        }
        
        write_page_data( nav_root );
        save_text_file( config.content_root + '/fm-sitemap.json', JSON.stringify( sitemap( nav_root) ) );
        if( !nav_watcher ){
            nav_watcher = watch_folder( config.content_root, "add,unlink", function( path, stat, event ){
                switch( event ){
                    case "add":
                        if( nav_root.path_list.indexOf( path ) === -1 ){
                            console.log( "ADDED", path );
                        }
                        break;
                    case "unlink":
                        if( nav_root.path_list.indexOf( path ) > -1 ){
                            console.log( "DELETED", path );
                        }
                        break;
                }
            });
        }
    } else if ( nav_tree_locks < 0 ){
        console.error( "Negative nav tree locks???", nav_tree_locks );
    }
}

/*
	Adapted from:
	http://elegantcode.com/2011/04/06/taking-baby-steps-with-node-js-pumping-data-between-streams/
*/
function stream_response( res, file_path, content_type ){
    var readStream = fs.createReadStream(file_path);

    readStream.on('data', function(data) {
        var flushed = res.write(data);
        // Pause the read stream when the write stream gets saturated
        // console.log( 'streaming data', file_path );
        if(!flushed){
            readStream.pause();
        }
    });

    res.on('drain', function() {
        // Resume the read stream when the write stream gets hungry 
        readStream.resume();
    });

    readStream.on('end', function() {
        res.end();
    });
    
    readStream.on('error', function(err) {
        console.error('Exception', err, 'while streaming', file_path);
        // TODO: remove from file_paths
        res.end();
    });
    
    res.writeHead(200, {'Content-Type': content_type});
}

function render_response( res, file_path, content_type ){
    if( content_type === undefined ){
        content_type = "text/html";
    }
	
	fs.readFile(file_path, function (err, data) {
		if (err) {
			fatal_error(res, err, 'could not render ' + file_path);
		} else {
			res.writeHead(200, {'Content-Type': content_type });
			res.end( data );
		}
	});	
}

/*
    Events are add (file added), change (file modified), unlink (file deleted/removed), error (self-explanatory)
*/
function watch_folder(path_to_watch, events, callback){
    var watcher = chokidar.watch(path.normalize(path_to_watch), {ignored: /\/\.[^\.]/, persistent: true}),
        i;

    events = events.split(/[,\s]/);
    
    for( i = 0; i < events.length; i++ ){
        (function(event){
            watcher.on(events[i], function(path, stat){
                callback.call( this, path, stat, event );
            });
        })(events[i]);
    }
    
    return watcher;
}

/*
    Render the web page!
    
    <!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>
    {title}
    </title>
    {css}
    </head><body>
    {script}
    </body></html>
*/
function render_index_page( res, path ){
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>folder.mark</title>',
        stylesheet,
        script;
        
    for( var i = 0; i < config.css.length; i++ ){
        stylesheet = config.css[i];
        if( stylesheet.indexOf('print') >= 0 ){
            html += '<link rel="stylesheet/less" type="text/css" media="print" href="' + stylesheet + '">';
        } else {
            html += '<link rel="stylesheet/less" type="text/css" media="screen" href="' + stylesheet + '">';
        }
    }
    html += "</head><body>";
    html += '<div id="home"></div>';
    html += '<div id="nav"></div>';
    html += '<div id="head"></div>';
    html += '<div id="content"></div>';
    for( var i = 0; i < config.js.length; i++ ){
        script = config.js[i];
        html += '<script src="' + script + '"></script>';
    }
    html += '<script>fm.loadPage("' + path + '");</script>';
    html += '</body></html>';
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end( html );
}

function render_page_data( res, page_path ){
    res.writeHead(200, {'Content-Type': 'application/json' });
    res.end( JSON.stringify({test: page_path}) );
}

function handle_file_request( req, res, file_path, file_type ){
    var stream_type = false;
	switch( file_type ){
	    case '.fm':
	        console.log( 'page data request', file_path );
	        render_page_data( res, file_path );
	        break;
		case '.pdf':
			stream_type = 'application/pdf';
			break;
		case '.zip':
	    case '.msi':
	    case '.dmg':
			stream_type = 'application/zip';
			break;
		case '.map':
		case '.json':
			stream_type = 'application/json';
			break;
		case '.js':
			stream_type = 'application/javascript';
			break;
		case '.xml':
		    stream_type = 'application/xml';
		    break;
		case '.xhtml':
		    stream_type = 'application/xhtml+xml';
		    break;
		case '.htm':
		case '.html':
			stream_type = 'text/html';
			break;
		case '.txt':
		case '.text':
		case '.md':
		case '.markdown':
			stream_type = 'text/plain';
			break;
		case '.jpg':
			stream_type = 'image/jpeg';
			break;
		case '.gif':
			stream_type = 'image/gif';
			break;
		case '.png':
			stream_type = 'image/png';
			break;
		case '.mp4':
		case '.m4v':
			stream_type = 'video/mp4';
			break;
		case '.ogg':
		    stream_type = 'audio/ogg';
		    break;
		case '.vorbis':
		    stream_type = 'audio/vorbis';
		    break;
		case '.aif':
		case '.aiff':
		    stream_type = 'audio/x-aiff';
		    break;
		case '.wav':
		    stream_type = 'audio/vnd.wav';
		    break;
		case '.mp3':
			stream_type = 'audio/mpeg';
			break;
		case '.mov':
		case '.qt':
			stream_type = 'video/quicktime';
			break;
		case '.css':
		case '.less':
			stream_type = 'text/css';
			break;
		default:
            nonfatal_error( res, 400, 'Bad Request (' + file_type + ')' );
	}
	if( stream_type ){
		stream_response( res, file_path, stream_type );
		// render_response( res, file_path, stream_type );
	}
}

function setup_web_server(){
    http.createServer( function( req, res ){
        var request_url = url.parse( req.url, true );
        var pathname = fuzz_path( request_url.pathname );
        var request_path = pathname.substr(0,8) === '/fm/lib/' 
                            ? pathname.substr(4)
                            : config.content_root + request_url.pathname;
        var request_type = path.extname( request_path );
        var path_index = nav_root.name_list.indexOf(pathname);
    
        if( !request_type ){
            render_index_page( res, request_url.pathname );
        } else {
            if( path_index > -1 ){
                // console.log( "cached path for", pathname, 'at', nav_root.path_list[path_index] );
                handle_file_request( req, res, nav_root.path_list[path_index], request_type );
            } else {
                // TODO: add /lib/ files to the path_list so this async call isn't needed
                fs.exists( request_path, function( found ){
                    if( found ){
                        // console.log( "found", pathname, 'at', request_path);
                        // we can simply add the new path because we know pathname wasn't found
                        nav_root.path_list.push( request_path );
                        nav_root.name_list.push( pathname );
                        handle_file_request( req, res, request_path, request_type );
                    } else {
                        console.log(request_path, 'not found');
                        nonfatal_error( res, 404,  'File Not Found (' + request_url.pathname + ')' );
                    }
                }); 
            }
        }
    }).listen(config.port, '127.0.0.1');
    console.log('Server running at http://127.0.0.1:' + config.port + '/');
}

fs.readFile('config.json', function(err, data){
    if( err ){
        throw err;
    }
    
    config = JSON.parse( data );
    // console.log( JSON.stringify( config, false, 2 ) );
    nav_root = {
        path: "",
        name: config.name,
        name_list: [],
        path_list: []
    };
    
    build_nav_tree( nav_root, setup_web_server);
});

