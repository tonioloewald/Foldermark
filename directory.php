<?php
	/* Copyright 2005-2011 Tonio Loewald */
	
	require_once( 'utilities.php' );

	class FMdirectory {
		private $d = NULL;
		// the path we used
		public $path = '';
		public $exists = false;
		public $continuation = false;
		public $first = 0;

		function __construct( $path ) {
			if( preg_match( '/\.continue\./', $path )){
				list( $path, $this->first ) = preg_split( '/\.continue\./', $path );
				if( substr( $this->first, -1 ) == '/'  ){
					$this->first = substr( $this->first, 0, -1 );
				}
				$this->continuation = true;
			}
			if( file_exists($path) && filetype($path) == 'dir' ){
				$this->exists = true;
				$this->path = $path;
				$this->d = dir( $path );
			} else {
				if( !file_exists( $path ) ){
					FatalError( "directory constructor failed: &ldquo;$path&rdquo; does not exist." );
				} else {
					FatalError( "directory constructor failed: &ldquo;$path&rdquo; is not a directory." );
				}
			}
		}

		function __destruct() {
			if( $this->d ){
				$this->d->close();
			}
		}

		function filter( $options, $entry ){
			$show_invisibles = Option( $options, 'show_invisibles', false );
			if( !$show_invisibles && substr($entry, 0, 1) == '.' ){
				return false;
			}
			
			$match = Option( $options, 'match', '' );
			if( $match != '' && $entry != $match ){
				return false;
			}

			$fileTails = OptionArray( $options, 'fileTails', false );
			if( $fileTails && !stringEndsWith( $entry, $fileTails ) ){
				return false;
			}

			$fileTypes = OptionArray( $options, 'fileTypes', false );
			if( $fileTypes && !stringEndsWith( $entry, $fileTypes, '.' ) ){
				return false;
			}

			$find = Option( $options, 'find', '' );
			if( $find != '' && strpos( $entry, $find ) === false ){
				return false;
			}

			$regex = Option( $options, 'regex', '' );
			if( $regex != '' && preg_match( $regex, $entry ) == 0 ){
				return false;
			}

			return true;
		}

		function listing( $options = NULL ){
			$listing = Option( $options, 'listing', NULL );
			$recursive = Option( $options, 'recursive', false );
			$limit_recursion = Option( $options, 'limit_recursion', false ); // don't drill into a folder if the folder itself is a hit
			$first_match = Option( $options, 'first_match', false ); // stop searching once you find a match
			$show_folders = Option( $options, 'show_folders', false );
			$show_files = Option( $options, 'show_files', true );
			$folder_suffix = Option( $options, 'folder_suffix', '' );
			
			 // allow scaling for arbitrarily large directories...
			 // if limit is positive, this is the maximum size list we will pass; if there are more files, we will
			 // return a continuation token (a virtual subdirectory which effectively points at the next set of files)
			 // the tokens look like /.continue.n/ where n is the index of the first file that will be returned
			$limit = Option( $options, 'limit', 0 );
			
			if( Option( $options, 'simple', false ) ){
				$detail = 'simple';
			}
			if( Option( $options, 'simple_no_path', false ) ){
				$detail = 'simple_no_path';
			}
			$detail = Option( $options, 'detail', false );

			if( gettype($listing) != "array" ){
				$listing = array();
			}
			profile_start('directory->listing');
			
			$done = false;
			$skip = $this->first;
			
			if( $this->d ){
				$path = $this->d->path;
				$this->d->rewind();
				while( ($entry = $this->d->read()) && !$done ){
					if( $entry == '.' || $entry == '..' ){
					} else {
						$entry_path = catpath( $path, $entry );
						$type = filetype($entry_path);
						$match = $this->filter( $options, $entry );
						if ( $match ){
							if (
								($show_folders && $type == 'dir') || ($show_files && $type == 'file')
							){
								if( $skip > 0 ){
									// don't add entries until we get to the "first"
									$skip--;
								} else {
									if( $type == 'dir' ){
										$entry .= $folder_suffix;
										$entry_path .= $folder_suffix;
									}
									switch( $detail ){
										case 'simple':
											$listing[] = $entry_path;
											break;
										case 'simple_no_path':
											$listing[] = $entry;
											break;
										case 'detailed':
											$listing[] = array(
												'name' => $entry,
												'path' => $entry_path,
												'type' => $type,
												'size' => filesize( $entry_path ),
												'mtime' => filemtime( $entry_path )
											);
											break;
										default:
											$listing[$entry_path] = $entry;
									}
									if( $first_match ){
										continue;
									}
								}
							}
						}
						// Recurse if required
						if( $type == 'dir' && $recursive && (!$limit_recursion || !$match) ){
							$sub_dir = new FMdirectory( $entry_path );
							$options['listing'] = $listing;
							$listing = $sub_dir->listing( $options );
						}
					}
					if( $limit > 0 && count( $listing ) >= $limit ){
						$token = '.continue.' . ($this->first + $limit) . $folder_suffix;
						switch( $detail ){
							case 'simple':
								$listing[] = catpath( $this->path, $token );
								break;
							case 'simple_no_path':
								$listing[] = $token;
								break;
							case 'detailed':
								$listing[] = array(
									'name' => $token,
									'path' => catpath($this->path, $token),
									'type' => 'dir',
									'size' => 1,
									'mtime' => time()
								);
								break;
							default:
								$listing[ catpath($this->path, $token) ] = $token;
						}
						$done = true;
					}
				}
			}
			
			profile_end('directory->listing');
			
			return $listing;
		}
	}

	/*
		Note that FMwebDirectory is in fact VERY different from FMdirectory and really only uses
		the filter method.
	*/
	class FMwebDirectory extends FMdirectory {
		private $url_parts;
		private $host;
		private $url;

		function __construct( $url ){
			if( preg_match( '/\.continue\./', $url )){
				list( $url, $this->first ) = preg_split( '/\.continue\./', $url );
				if( substr( $this->first, -1 ) == '/'  ){
					$this->first = substr( $this->first, 0, -1 );
				}
				$this->continuation = true;
			}
			$this->url = $url;
			$this->url_parts = parse_url( $url );
			if( !isset( $this->url_parts['path'] ) ){
				$this->url_parts['path'] = '';
			}
			$this->path = $this->url_parts['path'];
			if( isset( $this->url_parts['scheme'] ) ){
				$this->exists = true; // actually a bit optimistic...
				$this->host = $this->url_parts['scheme'] . '://' . $this->url_parts['host'] . '/';
			}
		}

		function __destruct() {
			// don't need to do anything
		}
		
		function make_absolute( $url ){		
			if( substr( $url , 0, 1 ) == '/' ){
				return catpath( $this->host, $url );
			} else if ( substr( $url, 0, 7 ) == 'http://' ){
				return $url;
			} else {
				return catpath($this->url, $url);
			}
		}

		function listing( $options = NULL ) {
			$listing = Option( $options, 'listing', NULL );
			$recursive = Option( $options, 'recursive', false );
			$show_folders = Option( $options, 'show_folders', false );
			$show_files = Option( $options, 'show_files', true );
			$limit = Option( $options, 'limit', 0 );
			
			if( Option( $options, 'simple', false ) ){
				$detail = 'simple';
			}
			if( Option( $options, 'simple_no_path', false ) ){
				$detail = 'simple_no_path';
			}
			$detail = Option( $options, 'detail', false );
			
			if( gettype($listing) != "array" ){
				$listing = array();
			}

			$html = file_get_contents($this->url);

			// echo $html;
			// preg_match_all( '/\<a [^\>]*href\=\"([^\"]+)\"[^\>]*\>([^\<]*)/', $html, $matches );
			preg_match_all( '/\<a [^\>]*href\=\"([^\"]+)\"[^\>]*\>([^\<]*)[^\n^0-9]*([0-9]{1,2}\-[0-9a-zA-Z]{1,4}\-[0-9]{4}[^0-9]+[0-9]{1,2}:[0-9]{2})[^\n^0-9]*([0-9\.\,]*[kKmMgG]{0,1})/', $html, $matches );
			$urls = $matches[1];
			$names = $matches[2];
			$times = $matches[3];
			$sizes = $matches[4];
			
			$done = false;
			$skip = $this->first;

			for( $i = 0; $i < count($urls) && !$done; $i++ ){
				$url = $urls[$i];
				$name = $names[$i];
				$good = true;
				if( $name == 'Parent Directory' ){
					$good = false;
				}
				if( substr( $url, 0, 1 ) == '?' && strlen( $url ) == 8 ){
					$good = false;
				}
				if( substr( $url, 0, 11 ) == 'javascript:' ){
					$good = false;
				}
				$absolute_url = $this->make_absolute( $url );
				if( $absolute_url == $this->url ){
					$good = false;
				}
				if( $good ){
					$type = substr( $absolute_url, -1 ) == '/' ? 'dir' : 'file' ;
					if( $this->filter( $options, $url ) ){
						if ( ( $show_folders && $type == 'dir' ) || ( $show_files && $type == 'file' ) ){
							if( $skip > 0 ){
								$skip--;
							} else {
								switch( $detail ){
									case 'simple_no_path':
										$listing[] = $url;
										break;
									case 'simple':
										$listing[] = $absolute_url;
										break;
									case 'detailed':
										$size = $sizes[$i];
										switch( substr( $size, -1 ) ){	
											case 'k':
											case 'K':
												$size *= 1024;
												break;
											case 'm':
											case 'M':
												$size *= 1048576;
												break;
											case 'g':
											case 'G':
												$size *= 1073741824;
												break;
										}
										$size = round( $size );
										$modified = strtotime( $times[$i] );
										$listing[] = array(
											'name' => $url,
											'path' => $absolute_url,
											'type' => $type,
											'size' => $size,
											'mtime' => $modified
										);
										break;
									default:
										if( $type == 'file' ){
											$parts = explode( '/', $url );
											if( count( $parts ) > 1 ){
												$url = array_pop( $parts );
											}
										} else {
											$parts = parse_url( $url );
											$url = $parts[ 'path' ];
										}
										$listing[$absolute_url] = $url;
								}
								if( $limit > 0 && count( $listing ) >= $limit ){
									$token = '.continue.' . ($this->first + $limit) . '/';
									switch( $detail ){
										case 'simple':
											$listing[] = catpath( $this->path, $token );
											break;
										case 'simple_no_path':
											$listing[] = $token;
											break;
										case 'detailed':
											$listing[] = array(
												'name' => $token,
												'path' => catpath($this->url, $token),
												'type' => 'dir',
												'size' => 1,
												'mtime' => time()
											);
											break;
										default:
											$listing[ $this->make_absolute(catpath($this->path, $token)) ] = $token;
									}
									$done = true;
								}
							}
						}
					}
					// Recurse if required
					if ( $type == 'dir' && $recursive ){
						$sub_dir = new FMwebDirectory( $absolute_url );
						$options['listing'] = $listing;
						$listing = $sub_dir->listing( $options );
					}
				}
			}
			return $listing;
		}
	}
?>
