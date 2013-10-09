var fm = {
    current_page: false,
    sitemap: false,
    converter: new Showdown.converter(),
    initPage: function(){
        var self = this;
        
        window.onpopstate = function(e){
            console.log( 'popping', e.state );
            if(e.state){
                fm.loadPage( e.state.url, true );
            }
        };
        
        $('body').on('click', 'a', function(e){
            var path = $(this).attr('href');
            self.loadPage( path );
            e.preventDefault();
        });
        
        function render_page_link( page, ul ){
            if( ul === undefined ){
                ul = $('<ul>');
            }
            var li = $('<li>')
                    .append( $('<a>')
                        .attr('href', page.path + '/')
                        .text(page.name) )
                    .appendTo(ul);
            
            if( page.pages ){
                $.each( page.pages, function(){
                    render_page_link( this, $('<ul>') ).appendTo(li);
                });
            }
            
            return ul;
        }
        
        $.getJSON( '/fm-sitemap.json', function( sitemap ){
            var nav = $('#nav');
            
            // console.log( 'sitemap', sitemap );
            self.sitemap = sitemap;
            
            $("<a>")
                .attr('href', '/')
                .text(sitemap.name)
                .appendTo('#home');
            
            nav.empty().append( render_page_link( sitemap ) );
        });
    },
    loadPage: function(url, doNotPush){
        var converter = this.converter,
            self = this;
        
        if( !this.current_page ){
            this.initPage();
        }
        
        if( url.substr(-1) !== '/' ){
            url += '/';
        }
        
        if( url === this.current_page ){
            return;
        }
        
        $.getJSON( url + 'fm.json', function(parts){
            var content = $('#content'),
                loc = window.location,
                new_url = loc.protocol + '//' + loc.host + url;
        
            if( !doNotPush ){
                console.log( 'pushing', new_url );
                window.history.pushState({ url: url }, '', new_url);
            }
            
            console.log(url);
            self.current_page = url;
            self.makeBreadcrumbs();
            
            $('#nav a').removeClass('current');
            $('#nav a[href="' + url + '"]').addClass('current');
            
            content.empty();
            $('body link').remove();
            
            for( var i = 0; i < parts.length; i++ ){
                var part = parts[i],
                    type = part.match(/\.([\w\-_]*)$/),
                    node;
                
                type = type === null ? undefined : type[1];
                switch( type ){
                    /* images */
                    case "gif":
                    case "jpg":
                    case "jpeg":
                    case "png":
                        content.append('<div><img src="' + part + '"></div>');
                        break;
                    /* markdown */
                    case "text":
                    case "txt":
                    case "md":
                    case "markdown":
                        node = $('<div>').appendTo(content);
                        (function(node){
                            $.ajax({
                                url: part,
                                success: function(text){
                                    // console.log(text);
                                    node.html( converter.makeHtml(text) );
                                }
                            });
                        })(node);
                        break;
                    /* markup */
                    case "xhtml":
                    case "htm":
                    case "html":
                        node = $('<div>').appendTo(content);
                        (function(node){
                            $.ajax({
                                url: part,
                                success: function(html){
                                    // console.log(text);
                                    var nodes = $(html);
                                    node.html( nodes.not('script') );
                                    $.each( nodes.filter('script'), function(idx, script){
                                        var source = '/* fragment script: ' + part + ' */\n' + script.text,
                                            fn = new Function(['parts'], source);
                                            fn.call(node, parts);
                                        try {
                                        } catch(e){
                                            console.error('Exception thrown in fragment script:', part);
                                        }
                                    });
                                }
                            });
                        })(node);
                        break;
                    /* javascript */
                    case "js":
                            $.ajax({
                                url: part,
                                success: function(script){
                                    var source = '/* fragment script: ' + part + ' */\n' + script.text,
                                        fn = new Function(['parts'], source);
                                        fn.call($('body'), parts);
                                    try {
                                    } catch(e){
                                        console.error('Exception thrown in fragment script:', part);
                                    }
                                }
                            });
                        break;
                    case "css":
                        // CSS
                        var link = $('<link>').attr({
                            'rel': 'stylesheet',
                            'type': 'text/css',
                            'href': part
                        }).prependTo('body');
                        console.log(link);
                        break;
                    case "xml":
                    case "json":
                        // nothing -- assume it's data meant for plugin
                        break;
                    case "pdf":
                    case "zip":
                    case "dmg":
                    case 'msi':
                        content.append('<div>Download <a href="' + part + '">' + part + '</a></div>');
                        break;
                    case "mov":
                    case "mp4":
                    case "qt":
                    case "m4v":
                        content.append('<div><video controls src="' + part + '"></div>');
                        break;
                    case 'aif':
                    case 'aiff':
                    case 'wav':
                    case 'mp3':
                        content.append('<div><audio controls src="' + part + '"></div>');
                        break;
                }
            }
            
            av.auto();
        });
    },
    makeBreadcrumbs: function(){
        var breadcrumbs = $('<div id="breadcrumbs">'),
            parts,
            url = '',
            name;
        
        if( this.current_page === '/' ){
            parts = [''];
        } else {
            parts = this.current_page.split('/');
            parts.pop();
        }
        
        // console.log(parts, this.current_page);
        for( var i = 0; i < parts.length; i++ ){
            url += parts[i] + '/';
            name = i === 0 ? this.sitemap.name : parts[i];
            if( i === parts.length - 1 ){
                breadcrumbs.append( '<span class="current">' + name + '</span>' );
            } else {
                breadcrumbs.append( '<a href="' + url + '">' + name + '</a>' );
            }
        }
        
        $('#head #breadcrumbs').remove();
        breadcrumbs.appendTo('#head');
    }
}