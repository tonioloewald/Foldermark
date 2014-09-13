/*
	Quick hack to make HTML5 video tags work anywhere automagically
	
	Author
	------
	
	Tonio Loewald (tonio@loewald.com)
	
	Home Page
	---------
	
	http://loewald.com/html5/av
	
	Credits
	-------
	
	Feature detection code adapted from http://diveintohtml5.org/everything.html
	
	Dependencies
	------------
	
	jQuery (easily replaced if you have to)
	
	Feel free to use as you see fit, but attribution (including the above) would be nice.
	
	If you want to use this code you'll probably need to fiddle with the Flash embed code to suit
	whichever flash player you end up using. When I get a few minutes I'll put together a free
	open source flash audio/video player to go with this. (I plan to expand this code to
	handle <audio> just as easily.
*/

var av = {
	player_url : 'av.swf',
	player_settings : {
		'allowScriptAccess' : 'always',
		'allowFullScreen' : 'true',
		'scale' : 'noscale',
		'salign' : 'tl',
		'wmode' : 'window',
		'bgcolor' : '#ffffff'
	},
	supports_video : function(){
			return !!document.createElement('video').canPlayType; 
	},
	supports_h264_baseline_video: function() { 
		if (!supports_video()) { return false; } 
		var v = document.createElement("video"); 
		return v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'); 
	},
	supports_video : function() { 
		return !!document.createElement('video').canPlayType; 
	},
	supports_h264_baseline_video : function () { 
		if (!this.supports_video()) { return false; } 
		var v = document.createElement("video"); 
		return v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'); 
	},
	supports_audio : function() {
		return !!document.createElement('audio').canPlayType
	},
	supports_mp3 : function() {
		if (!this.supports_audio()) { return false; } 
		var a = document.createElement('audio'); 
		return !!(a.canPlayType && a.canPlayType('audio/mpeg;').replace(/no/, ''));
	},
	flash_embed : function( w, h, src ){
		var f = '<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" ';
		var e = '';
		f += 'codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=9,0,0,0" ';
		f += 'width="' + w + '" height="' + h + '">';
		for( var prop in this.player_settings ){
			var val = this.player_settings[prop];
			f += '<param name="' + prop + '" value="' + val + '" />';
			e += ' ' + prop + '="' + val + '"';
		}
		f += '<param name="movie" value="' + this.player_url + '?media_url=' + src + '" />';
		f += '<embed width="' + w + '" height="' + h + '" src="' + this.player_url + '?media_url=' + src + '"';
		f += e + 'type="application/futuresplash" /></object>';
		return f;
	},
	replace_html5_media_tags : function(){
		$('video').replaceWith(function(){
			var src = $(this).attr('src');
			var w = $(this).width();
			var h = $(this).height();
			return av.flash_embed( w, h, src );
		});
		$('audio').replaceWith(function(){
			var src = $(this).attr('src');
			var w = 256;
			var h = 24;
			return av.flash_embed( w, h, src );
		});
	}
}

$(function(){
	if( !av.supports_h264_baseline_video() || !av.supports_mp3() ){
		av.replace_html5_media_tags();
	}
});
