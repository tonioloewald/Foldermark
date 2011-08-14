<?php
	/* Copyright 2005-2011 Tonio Loewald */
	
	class FMdebug {
		static public $log = array();
		static public $call_stack = array();
		static public $process_data = array();
		static public $max_log_length = 100;

		static function log( $msg ){
			if( defined('STDIN') ){
				echo "{$msg}\n";
			} else if( count(FMdebug::$log) < FMdebug::$max_log_length ){
				FMdebug::$log[] = clean_xml_str( $msg );
			}
		}
		
		static function report_body(){
			$body = '';
			foreach( FMdebug::$log as $line ){
				$body .= "$line\n";
			}
			$body .= "\n";
			return $body;
		}
		
		static function profile_body(){
			$body = str_pad('Process', 45) . str_pad('Time', 10) . str_pad( 'Calls', 6 ) . str_pad( 'Memory Delta', 12 ) . "\n";
			foreach( FMdebug::$process_data as $process => $data ){
				$body .= str_pad($process, 45) . str_pad(number_format($data['time'], 3), 10) . str_pad($data['calls'], 6) . str_pad($data['memory'], 12) . "\n";

			}
			return $body;
		}

		static function report( $start_tag = "\n<!--\n", $end_tag = "-->\n" ){
			echo "\n\n";
			echo $start_tag;
			if( count(FMdebug::$log) ){
				echo "[Debug Log]\n";
				echo FMdebug::report_body();
			}
			echo "[Profile Info]\n";
			echo FMdebug::profile_body();
			echo $end_tag;
		}

		static function startProcess( $name ){
			array_push( FMdebug::$call_stack, array( 'start' => microtime(true), 'name' => $name, 'memory' => memory_get_peak_usage() ) );
		}

		static function endProcess( $name ){
			$mem = memory_get_peak_usage();
			$current_process = array_pop( FMdebug::$call_stack );
			if( $current_process['name'] != $name ){
				$stack = '';
				foreach( FMdebug::$call_stack as $item ){
					$stack .= $item['name'] . ' ';
				}
				FatalError( "Profile error -- endProcess('$name') called without corresponding startProcess('{$current_process['name']}').\nCall stack: $stack" );
			} else {
				$time_in = microtime(true) - $current_process['start'];
				$mem = memory_get_peak_usage() - $current_process['memory'];

				if( !isset( FMdebug::$process_data[ $name ] ) ){
					$process_info = array('time' => $time_in, 'calls' => 1, 'memory' => $mem);
					FMdebug::$process_data[$name] = $process_info;
				} else {
					$process_info = FMdebug::$process_data[ $name ];
					$process_info['time'] += $time_in;
					$process_info['calls'] += 1;
					$process_info['memory'] += $mem;
					FMdebug::$process_data[$name] = $process_info;
				}

				return $time_in;
			}
		}
	}

	// simple class for timing things
	class FMtimer {
		public $start_time;

		function __construct(){
			$this->start_time = microtime(true);
		}

		function elapsed() {
			$t = (microtime(true) - $this->start_time);
			return $t;
		}
	}

	// Reduces a string to a manageable size by inserting an ellipsis (if needed) about 2/3 of the way through
	function trunc_string( $s, $max_size = 40 ){
		$s = trim($s, " \t\n\r\0\x0B.,;:-");
		$len = strlen( $s );
		if( $len <= $max_size ){
			return $s;
		} else {
			$start = floor( $max_size * 0.6 );
			$end = $len - $max_size + $start;
			$start -= 3;
			return clean_xml_str( mb_substr( $s, 0, $start ) . '...' . mb_substr( $s, $end ) );
		}
	}

	// makes sure a string is OK in an XML file
	// (note that -- is illegal in XML comments)
	function clean_xml_str( $msg ){
		$msg = str_replace( '&', '&amp;', $msg );
		return str_replace(
			array('<', '>', '"', '\'', '--'),
			array('$lt;', '&gt;', '&quot;', '&apos;', '&mdash;'),
			$msg
		);
	}

	function clean_sql_str( $s ){
		return str_replace(
			array('`', '\'', '"', '*', '%'),
			'',
			$s
		);
	}
	
	function clean_html_str( $s ){
		return htmlentities( $s, ENT_COMPAT, 'UTF-8' );
	}

	// Form Convenient Functions
	function getPost( $var, $default = '' ){
		if( isset( $_POST[$var] ) ){
			return $_POST[$var];
		} else {
			return $default;
		}
	}

	function getGet( $var, $default = '' ){
		if( isset( $_GET[$var] ) ){
			return $_GET[$var];
		} else {
			return $default;
		}
	}

	// Debug convenience functions
	function debug_report( $start_tag = false, $end_tag = false ){
		if( $start_tag === false ){
			$start_tag = defined('STDIN') ? '' : "\n<!--\n";
		}
		if( $end_tag === false ){
			$end_tag = defined('STDIN') ? '' : "\n-->\n";
		}
		if( defined('STDIN') || (defined('DEBUG') && DEBUG) ){
			FMdebug::report( $start_tag, $end_tag );
		}
	}

	function debug_log( $msg ){
		if( defined('STDIN') ){
			echo $msg . "\n";
		} elseif ( defined('DEBUG') && DEBUG ){
			FMdebug::log( $msg );
		}
	}

	function profile_start( $name ){
		if( defined('DEBUG') && DEBUG ){
			FMdebug::startProcess( $name );
		}
	}

	function profile_end( $name ){
		if( defined('DEBUG') && DEBUG ){
			return FMdebug::endProcess( $name );
		}
	}

	function listFrom ( $x ){
		if( gettype($x) == 'array' ){
			return $x;
		} else {
			return array( $x );
		}
	}

	function remote_filesize( $url ){
		$header = http_head( $url );
		preg_match( '/Content\-Length:\s([0-9]*)/', $header, $matches );
		if( count($matches) ){
			return $matches[1];
		} else {
			return 0;
		}
	}

	// Used to convert raw filesize numbers into something human readable (such as kB, MB, etc.)
	function readable_size( $size ){
		if( $size < 1024 ){
			return round($size) . ' <span style="font-size: 75%;">B</span>';
		}

		$size = $size / 1024;
		if( $size < 1024 ){
			return round($size) . ' <span style="font-size: 75%;">kB</span>';
		}

		$size = $size / 1024;
		if( $size < 1024 ){
			return round($size) . ' <span style="font-size: 75%;">MB</span>';
		}

		$size = $size / 1024;
		if( $size < 1024 ){
			return round($size) . ' <span style="font-size: 75%;">GB</span>';
		}

		$size = $size / 1024;
		return round($size) . ' <span style="font-size: 75%;">TB</span>';
	}

	function fixroot_http( $path ){
		/* IP address needs to be moved to configuration */
		$app_host = defined('STDIN') ? 'acumen.lib.edu' : $_SERVER['HTTP_HOST'] ;
		if( substr( $path, 0, 1 ) == '/' ){
			$path = catpath( 'http://' . $app_host, $path );
		}
		return $path;
	}

	// comments keeping it fragile to create parse errors on lazy calls
	function fixroot( $path, $root = false ){ // = false ){
		if( substr( $path, 0, 1 ) == '/' ){
			if( !$root ){
				$root = $_SERVER['DOCUMENT_ROOT'];
			}
			$root = explode( '/', $root );
			$name = explode( '/', $_SERVER['SCRIPT_NAME'] );
			while( $root[ count($root) - 1 ] == $name[ count($name) - 1 ] ){
				array_pop( $root );
				array_pop( $name );
			}
			$root = implode( '/', $root );
			$name = implode( '/', $name );
			if( substr( $path, 0, strlen( $name ) ) == $name ){
				$path = substr( $path, strlen($name) );
			}
			if( substr( $path, 0, strlen( $root ) ) != $root ){
				$path = catpath( $root, $path );
			}
		}
		return $path;
	}

	// return's $file's file type extension
	// if passed an array of types, will return the type if it's in the array, or false otherwise
	function fileExt ( $file, $types = false ){
		$type = pathinfo($file, PATHINFO_EXTENSION);
		if( gettype($types) == 'array' ){
			foreach( $types as $t ){
				if( $t == $type ){
					return strtolower($type);
				}
			}
			return false;
		}
		return strtolower($type);
	}

	function stringEndsWith( $s, $ending, $beginning_of_end = '', $case_sensitive = false ){
		if( !is_array( $ending ) ){
			$ending = array( $ending );
		}
		if( !$case_sensitive ){
			$s = strtolower( $s );
			$beginning_of_end = strtolower( $beginning_of_end );
		}
		foreach( $ending as $end ){
			$end = $case_sensitive ? $beginning_of_end . $end : $beginning_of_end . strtolower( $end ) ;
			if ( strlen( $s ) >= strlen( $s ) && substr( $s, -strlen($end) ) == $end ) {
				return $end;
			}
		}
		return false;
	}

	function regexpEscape( $s ){
		// Escapes characters which have semantic meaning in regular expressions
		return preg_replace( '/([\(\)\[\]\/\?\+\-\.\*])/', "\\\\" . '$1', $s );
	}

	// given foo.bar.baz, returns foo.bar
	function baseFilename( $file ){
		$parts = explode( '/', $file );
		if( count($parts) == 1 ){
			return $file;
		} else {
			$ext = array_pop($parts);
			return implode( '.', $parts );
		}
	}

	// given foo.bar.baz returns foo
	function rootFilename( $file ){
		$parts = explode( '.', $file );
		return $parts[0];
	}

	function folderPath( $file ){
		$parts = explode( '/', $file );
		$file_name = array_pop($parts);
		$folder_path = implode( '/', $parts ) . '/';
		return $folder_path;
	}

	function parentFolder( $path ){
		$path = explode( '/', $path );
		$last = array_pop( $path );
		if( $last == '' ){
			$last = array_pop( $path );
		}
		return implode( '/', $path );
	}

	function FatalError ( $msg, $show_debug_info = false ){
		if( $show_debug_info ){
			debug_report();
		}
		die( $msg );
		exit();
	}

	function clamp( $val, $min, $max ){
		return $val < $min ? $min : ( $val > $max ? $max : $val ) ;
	}

	// Note this functionality requires Javascript support that is currently not in the /lib
	function tab_selector( $tab_list, $default = 0, $insertion = '' ){
		echo "<ul class=\"tab_selector\" $insertion>\n";
		for( $i = 0; $i < count($tab_list); $i++ ){
			if( (is_integer($default) && $default == $i) || (is_string($default) && $default == strtolower($tab_list[$i])) ){
				echo "<li class=\"selected\">{$tab_list[$i]}</li>\n";
			} else {
				echo "<li>{$tab_list[$i]}</li>\n";
			}
		}
		echo "</ul>\n";
	}

	function Option( $options, $key, $default = false ){
		if( gettype($options) == 'array' && isset( $options[$key] ) ){
			return $options[$key];
		} else {
			return $default;
		}
	}

	function OptionArray( $options, $key, $default = false ) {
		$option = Option( $options, $key, $default );
		if( $option && gettype($option) != 'array' ){
			$option = array( $option );
		}
		return $option;
	}

	function Trace ( $note ){
		echo "<p style=\"font-weight: bold\">$note</p>\n";
		echo "<pre>\n";
		debug_print_backtrace();
		echo "</pre>\n";
	}

	// ensures there will only be one "/" joining two path components
	function catpath ( $p1, $p2 ){
		if( substr( $p1, -1, 1 ) != '/' ){
			$p1 .= '/';
		}
		if( substr( $p2, 0, 1 ) != '/' ){
			return $p1 . $p2;
		} else {
			return $p1 . substr( $p2, 1 );
		}
	}

	// urlencode is broken
	function partial_urlencode( $s ){
		return str_replace(
			array( ' ', '%', '\\' ),
			array( '%20', '%25', '%5C' ),
			$s
		);
	}

	function dump( $a, $show_keys = true, $force_simple_table = false ) {
		profile_start( 'dump' );
		switch( gettype( $a ) ){
			case 'object':
				$c = get_class( $a );
				echo "<h5>$c</h5>\n";
			case 'array':
				echo "<table border=\"1\">\n";
				if( $force_simple_table ){
					echo "<tr>";
					echo "<th>" . implode( "</th><th>", array_keys($a[0]) ) . "</th>";
					echo "</tr>\n";
					foreach( $a as $v ){
						echo "<tr>";
							echo "<td>" . implode( "</td><td>", $v ) . "</td>";
						echo "</tr>\n";
					}
				} else {
					foreach( $a as $k => $v ){
						echo "<tr class=\"alt_shaded\">";
						if( $show_keys ){
							echo "<th>$k</th>";
						}
						echo "<td>";
						dump( $v, $show_keys );
						echo "</td></tr>\n";
					}
				}
				echo "</table>\n";
				break;
			case 'string':
				echo "$a";
				break;
			default:
				$a = '' . $a;
				$s = strlen( $a );
				if( substr($a, 0, 1) != '<' && $s > 400 ){
					$a = substr($a, 0, 400) . "<span class=\"cont\">... (continues) [$s characters]</span>\n";
				}
				echo "$a";
				break;
		}
		profile_end( 'dump' );
	}

	function file_size( $path ){
		if( substr( $path, 0, 7 ) == 'http://' ){
			return 1234; // bogus value
		} else {
			return filesize( $path );
		}
	}

	function file_mtime( $path ){
		if( substr( $path, 0, 7 ) == 'http://' ){
			return time(); // Now!
		} else {
			return filemtime( $path );
		}
	}

	function select( $name, $choices, $current, $insertion = '', $use_text_values = false ){
		echo "<select name=\"$name\" $insertion>\n";
			foreach( $choices as $val => $text ){
				$s = $current == $val ? 'selected' : '';
				if( $use_text_values ){
					echo "<option $s value=\"$text\">$text</option>\n";
				} else {
					echo "<option $s value=\"$val\">$text</option>\n";
				}
			}
		echo "</select>\n";
	}

	// interactive directory picker
	// depends on the json feed module (bad!)
	function select_path_from_list( $name, $path, $options = array() ){
		$insertion = Option( $options, 'insertion', '' );
		$rows = Option( $options, 'rows', '10' );
		$show_files = isset( $options['show_files'] ) && $options['show_files'] ? 'files=1&' : '' ;
?>
	<script type="text/javascript">
		// requires jQuery 1.3 or later!
		function path_picker( name, base_path, json_url ){
			var picker = document.getElementById( 'path_selector_' + name );
			$('#path_selector_' + name).click( function(){
				document.getElementById( 'path_selected_' + name ).value = picker.options[picker.options.selectedIndex].value;
			} ).dblclick( function() {
				path = picker.options[picker.options.selectedIndex].value;
				if( path.substr( -1 ) == '/' || path.split('/').pop().substr(0,6) == '_from_' ){
					clear_path_picker( picker );
					populate_picker( name, base_path, path, json_url );
				}
			} );
			populate_picker( name, base_path, base_path, json_url );
		}

		function parent_path( path ){
			// remove trailing slash if necessary
			if( path.substr(-1) == '/' ){
				path = path.substr(0, path.length - 1);
			}
			return path.substr( 0, path.length - path.split('/').pop().length );
		}

		function clear_path_picker( picker ){
			while( picker.options[0] ){ picker.options[0] = null; }
		}

		function update_path_picker( name, data, base_path ){
			document.getElementById( 'path_display_' + name ).innerHTML = data.path;
			document.getElementById( 'path_selected_' + name ).value = data.path;
			var list = data.list;
			var picker = document.getElementById( 'path_selector_' + name );
			clear_path_picker( picker );
			var offset = 0;
			if( base_path != data.path ){
				picker.options[0] = new Option( '~ (Home)', base_path, false, false );
				picker.options[1] = new Option( '.. (Parent)', parent_path(data.path), false, false );
				offset = 2;
			}
			for( var i = 0; i < list.length; i++ ){
				picker.options[i + offset] = new Option( list[i][1], list[i][0], false, false );
			}
		}

		function populate_picker( name, base_path, path, json_url ){
			$.getJSON( json_url + path, function( data ){
				update_path_picker( name, data, base_path );
			});
		}

		$(document).ready( function(){
			path_picker( '<?php echo $name ?>', '<?php echo $path ?>', '<?php echo USER_PATH ?>json/path?<?php echo $show_files; ?>p=' );
		} );
	</script>
<?php
		echo "<div class=\"path_picker\" $insertion>\n";
		echo "<p id=\"path_display_$name\"></p>";
		echo "<select size=\"$rows\" id=\"path_selector_$name\" name=\"path_selector_$name\">\n";
		echo "</select><br/>\n";
		echo "<input id=\"path_selected_$name\" name=\"$name\" />";
		echo "</div>\n";
	}

	// requires mysql_db
	function select_type( $db, $name, $type_table, $current, $value_column = 'type', $insertion = '' ){
		$list = $db->get_all( $type_table );
		echo "<select name=\"$name\" $insertion>\n";
		foreach( $list as $item ){
				$val = $item[$value_column];
				$type = $item['type'];
				$s = $current == $type ? 'selected' : '';
				echo "<option $s value=\"$val\">$type</option>\n";
		}
		echo "</select>\n";
	}

	function random_string( $length=10 ){
		$s = '';
		$c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
		for( $i = 0; $i < $length; $i ++ ){
			$w = mt_rand( 0, strlen( $c ) - 1 );
			$s .= substr( $c, $w, 1 );
		}
		return $s;
	}
	
	function json_output( $json, $test_mode = false ){
		if( $test_mode ){
			echo "<pre>\n";
			echo json_encode( $json ) . "\n";
			echo "</pre>\n";
			dump( $json );
		} else {
			header('Cache-Control: no-cache, must-revalidate');
			header('Expires: Mon, 26 Jul 1997 05:00:00 GMT'); // some time in the past
			header('Content-type: application/json; charset=UTF-8');
			echo json_encode( $json ); //jsencode( $json );
		}
	}
?>
