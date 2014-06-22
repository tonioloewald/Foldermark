<?php
	require_once( "directory.php" );
	
	define('CONTENT_PATH', '../fm-test');
	define('DEV_MODE', true);
	$path = $_GET['p'];
	$response = array( 'status' => 400, 'version' => '0.0.2' );
	
	if( $path ){
	    $path_parts = explode('/', $path);
	    $response['status'] = 200;
	    $response['parts'] = $path_parts;
	    $dir = new FMDirectory( CONTENT_PATH );
	    //foreach( $path_parts as $part ){
	        $listing = $dir->listing(array(
	            'show_folders' => true,
	            //'simple_no_path' => true,
	            'details' => true
	        ));
	        $response['list'] = $listing;  
	    //}
	}
	
    header('Content-Type: application/json; charset=utf8');
    
    if( DEV_MODE ){
        header("Cache-Control: no-cache, must-revalidate"); // HTTP/1.1
        header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past
    }
    header('HTTP/1.0 ' + $response['status']);
	echo json_encode( $response );
?>