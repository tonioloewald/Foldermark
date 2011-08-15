<?php
	/* Copyright 2005-2011 Tonio Loewald */
	
	define( 
		'APP_ROOT', 
		'http://' . $_SERVER['HTTP_HOST'] . pathinfo( $_SERVER['SCRIPT_NAME'], PATHINFO_DIRNAME ) . '/' 
	);
	define( 'SCREEN_CSS', APP_ROOT . 'screen.css' );
	define( 'PRINT_CSS', APP_ROOT . 'print.css' );
	
	require_once( "directory.php" );
	require_once( 'lib/markdown.php' );
	
	isset( $_GET['b'] ) || die( 'error' );
	$base = $_GET['b'];
	
	if( isset($_GET['u']) ){
		$page = $_GET['u'];
	} else {
		$page = false;
	}
	
	$home = isset($_GET['h']) ? $_GET['h'] : 'Home';
	
	// renders file sizes in more human-friendly form
	function nice_size( $filepath ){
		$size = filesize( $filepath );
		if( $size < 1000 ){
			return $size . 'B';
		}
		$size /= 1000;
		if( $size < 1000 ){
			return round($size,1) . 'kB';
		}
		$size /= 1000;
		if( $size < 1000 ){
			return round($size,1) . 'MB';
		}
		$size /= 1000;
		return round($size,1) . 'GB';
	}
	
	function filename_to_title( $name ){
		$t = explode( '_', $name, 2 );
		$t = array_pop( $t );
		return preg_replace( '/[\-_]/', ' ', $t );
	}
		
	function directory_sort_alpha( $a, $b ){
		return strcmp( $a['name'], $b['name'] );
	}
	
	function directory_sort_recent( $a, $b ){
		return  $b['mtime'] - $a['mtime'];
	}
	
	class FMPage {
		public $base;
		public $page;
		public $sitename;
		public $title;
		public $folder;
		public $less = array();
		public $css = array();
		public $parts = array();
		public $js = array();
		public $error = false;
		
		function __construct( $base, $page, $sitename ){
			$this->base = $base;
			$this->page = $page;
			$this->sitename = $sitename;
			if( $page ){
				$this->title = $sitename . ' &gt; ' . rawurldecode( $page );
				$this->folder = $base . $page;
			} else {
				$this->title = $sitename;
				$this->folder = $base;
			}
			
			$folder_path = fixroot( $this->folder );
			if( !file_exists( $folder_path ) || filetype( $folder_path ) != 'dir' ){
				$this->folder = $base;
				$folder_path = fixroot( $this->folder );
				$this->error = "&ldquo;$page&rdquo; not found.";
			}
			
			$page_folder = new FMdirectory( $folder_path );
		
			$page_list = $page_folder->listing( array( 
				'show_files' => true, 
				'detail' => 'detailed' 
			) );
			
			if( count($page_list) ){
				foreach( $page_list as $item ){
					$this->add_file( $this->folder, $item['name'] );
				}
			}
		}
		
		function add_file( $folder, $file ){
			$url = $folder . $file;
			$path = fixroot( $url );
			
			$parts = pathinfo( $path );
			$ext = $parts['extension'];
			
			switch( $parts['filename'] ){
				case 'favicon':
					return;
			}
			
			switch( $ext ){
				case 'zip':
				case 'pdf':
				case 'msi':
				case 'dmg':
				case 'm4v':
				case 'mp4':
				case 'mp3':
				case 'png':
				case 'jpg':
				case 'jpeg':
				case 'gif':
				case 'txt':
				case 'markdown':
				case 'htm':
				case 'html':
				case 'xml':
				case 'php':
					$this->parts []= $url;
					break;
				case 'less':
					$this->less []= $url;
					break;
				case 'css':
					$this->css []= $url;
					break;
				case 'js':
					$this->js []= $url;
					break;
			}
		}
		
		function render_head(){
			echo "<!DOCTYPE html>\n";
			echo "<head><title>{$this->title}</title>\n";
			$this->render_styles();
			echo "</head>\n<body>\n";
		}
		
		function render_breadcrumbs(){
			echo "<div id='head'><div id='breadcrumbs'>\n";
			if( $this->page ){
				echo "<a href=\"{$this->base}\">{$this->sitename}</a> ";
				$breadcrumbs = $this->page;
				if( substr( $breadcrumbs, 0, 1 ) == '/' ){
					$breadcrumbs = substr($breadcrumbs, 1 );
				}
				if( substr( $breadcrumbs, -1 ) == '/' ){
					$breadcrumbs = substr($breadcrumbs, 0, strlen( $breadcrumbs ) - 1 );
				}
				$breadcrumbs = explode( '/', $breadcrumbs );
				$current = filename_to_title( array_pop( $breadcrumbs ) );
				$url = $this->base;
				foreach( $breadcrumbs as $crumb ){
					$url .= $crumb . '/';
					echo "<a href='$url'>" . filename_to_title($crumb) . '</a>';
				}
				echo "<span class=\"current\">$current</span>";
			} else {
				echo "<span class=\"current\">{$this->sitename}</span>";
			}
			echo "</div></div>\n";
		}
		
		function render_navigation( $base = false, $page = false ){
			$render_div = !$base;
			$base || $base = $this->base;
			$page || $page = $this->page;
			$url = $base . $page;
			$d = new FMdirectory( fixroot($base) );
			
			$list = $d->listing( array( 
				'show_folders' => true, 
				'show_files' => false, 
				'detail' => 'detailed' 
			) );
			
			usort( $list, 'directory_sort_alpha' );
			// usort( $list, 'directory_sort_recent' );
			
			if( $render_div ){
				echo "<div id='home_link'><a href='$base'>$this->sitename</a></div>\n";
				echo "<div id='nav'><ul>\n";
			} else {
				echo "<ul>\n";
			}
			foreach( $list as $item ){
				$name = $item['name'];
				switch( $name ){
					// images and assets are assumed to be hidden
					case 'images':
					case 'assets':
					case 'folder.mark':
						break;
					default:						
						$path = $base . rawurlencode( $item['name'] );
						$display_name = filename_to_title( $name );
						if( $url == $base . $item['name'] .'/' ){
							echo "<li><span class=\"current\">$display_name</span>";
						} else {
							echo "<li><a href=\"$path/\">$display_name</a>";
						}
						if( $path . '/' == substr( $url, 0, strlen($path) + 1 ) ){
							$this->render_navigation( $path . '/', substr($url, strlen($path) + 1 ) );
						}
						echo "</li>\n";
				}
			}
			if( $render_div ){
				echo "</ul></div>\n";
			} else {
				echo "</ul>\n";
			}
		}
		
		function render_content(){
			echo "<div id='content'>\n";		
			if( $this->error ){
					$text = file_get_contents( $path );
					$text = str_replace( 
							array( ' -- ' ),
							array( ' &#151; ' ),
							$text
						);
					$text = markdown( $text );
					$text = preg_replace( '/\[[\_\s]\]([^\n]+)\n/', '<p class="todo">$1</p>' . "\n", $text );
					$text = preg_replace( '/\[x\]([^\n]+)\n/', '<p class="done">$1</p>' . "\n", $text );
					$text = preg_replace( '/\[\-\]([^\n]+)\n/', '<p class="inprogress">$1</p>' . "\n", $text );
				echo "<blockquote><h1>Error</h1>\n<p>$error</p>\n</blockquote><hr />\n";
			}
			// sort elements
			if( !count( $this->parts ) ){
				echo "<p>This page has no content</p>\n";
			}
			natcasesort( $this->parts );
			foreach( $this->parts as $url ){
				$parts = pathinfo( $url );
				$path = fixroot( $url );
				$ext = $parts['extension'];
				$title = filename_to_title( $parts['filename'] );
				$modified_date = date("m/d/Y H:i:s", filemtime($path));
				$include = '';
				$text = '';
				switch( $ext ){
					case 'png':
					case 'jpg':
					case 'jpeg':
					case 'gif':
						$text = "<img alt=\"$title\" src=\"$url\" />\n";
						break;
					case 'm4v':
					case 'mp4':
						$text = "<video width='400' height='225' src='$url' controls='true'></video>\n";
						break;
					case 'mp3':
						$text = "<audio width='400' height='16' controls='true' src='$url' type='audio/mpeg'></audio>\n";
						break;
					case 'zip':
					case 'pdf':
					case 'msi':
					case 'dmg':
						$size = nice_size( $path );
						$text = "<p><a class='download' href='$url'>$title</a> <span class='download_type'>{$parts['extension']}</span><span class='download_size'>$size</span></p>\n";
						break;
					case 'markdown':
					case 'txt':						
						$text = file_get_contents( $path );
						$text = str_replace( 
								array( ' -- ' ),
								array( ' &#151; ' ),
								$text
							);
						$text = markdown( $text );
						break;
					case 'htm':
					case 'html':
					case 'xml':
						$text = file_get_contents( $path );
						break;
					case 'php':
						$include = $path;
						break;
				}
				echo "<span class='page'>";
				echo $text;
				if( $include ){
					include( $include );
				}
				echo "<span class='title'>$title</span>\n"
					. "<span class='ext'>$ext</span>\n"
					. "<span class='last_modified'>$modified_date</span>\n"
					. "</span>\n";
			}
			echo "</div>\n";
		}
		
		function render_styles(){
			natcasesort( $this->css );
			echo "<link rel='stylesheet/less' type='text/css' media='screen' href='" . SCREEN_CSS . "'>\n";
			echo "<link rel='stylesheet/less' type='text/css' media='print' href='" . PRINT_CSS . "'>\n";
			foreach( $this->css as $css ){
				echo "<link rel='stylesheet/css' type='text/css' media='screen' href='{$css}'>\n";
			}
			foreach( $this->less as $less ){
				echo "<link rel='stylesheet/less' type='text/css' media='screen' href='{$less}'>\n";
			}
			echo "<script src='" . APP_ROOT . "lib/less.js'></script>\n";
		}
		
		function render_scripts(){
			natcasesort( $this->js );
			echo "<script src='" . APP_ROOT . "lib/jquery.js'></script>\n";
			echo "<script src='" . APP_ROOT . "lib/av.js'></script>\n";
			echo "<script> av.player_url = '" . APP_ROOT. "/lib/av.swf'; </script>";
			foreach( $this->js as $js ){
				echo "<script type='text/javascript' src='{$js}'></script>\n";
			}
		}
		
		function render_tail(){
			echo '<p class="url">http://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] . "</p>\n";
			echo '<div class="ad">Powered by <a href="http://foldermark.com">FolderMark</a></div>' . "\n";
			echo "</body>\n</html>";
		}
		
		function render_page(){
			$this->render_head();
			$this->render_navigation();
			$this->render_breadcrumbs();
			$this->render_content();
			$this->render_scripts();			
			$this->render_tail();
		}
	}
	
	$po = new FMPage( $base, $page, $home );

	$po->render_page();
?>
