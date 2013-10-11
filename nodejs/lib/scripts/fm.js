var fm = {
    current_page: false,
    sitemap: false,
    converter: new Showdown.converter(),
    initPage: function(){
        var self = this;
        
        window.onpopstate = function(e){
            // console.log( 'popping', e.state );
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
            
            self.updateNav();
        });
    },
    newDiv: function(title, part, type, target, html){
        var div = $('<div>').attr({
                        'data-part': part,
                        'data-title': title
                    })
                    .addClass(type)
                    .appendTo(target);
        if( html ){
            div.html( html );
        }
        return div;
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
                // console.log( 'pushing', new_url );
                window.history.pushState({ url: url }, '', new_url);
            }
            
            // console.log('received part', url);
            self.current_page = url;
            self.updateNav();
            
            content.empty();
            $('body link').remove();
            
            for( var i = 0; i < parts.length; i++ ){
                var part = parts[i],
                    type = part.match(/\.([\w\-_]*)$/),
                    node,
                    title = part.split('/').pop().split('.').shift();
                
                type = type === null ? undefined : type[1];
                switch( type ){
                    /* images */
                    case "gif":
                    case "jpg":
                    case "jpeg":
                    case "png":
                        self.newDiv(title, part, 'image', content, '<img alt="' + title + '" src="' + part + '">');
                        break;
                    /* markdown */
                    case "text":
                    case "txt":
                    case "md":
                    case "markdown":
                        (function(node){
                            $.ajax({
                                url: part,
                                success: function(text){
                                    // console.log(text);
                                    node.html( converter.makeHtml(text) );
                                }
                            });
                        })(self.newDiv(title, part, 'markdown', content));
                        break;
                    /* markup */
                    case "xhtml":
                    case "htm":
                    case "html":
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
                        })(self.newDiv(title, part, 'html', content));
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
                        // CSS -- note that adding the links to the head and then removing them later is mysteriously broken
                        var link = $('<link>').attr({
                            'rel': 'stylesheet',
                            'type': 'text/css',
                            'href': part
                        }).prependTo('body');
                        break;
                    case "xml":
                    case "json":
                        // nothing -- assume it's data meant for plugin
                        break;
                    case "pdf":
                    case "zip":
                    case "dmg":
                    case 'msi':
                        self.newDiv(title, part, 'download', content, '<p>Download <a href="' + part + '">' + title + '</a></p>');
                        break;
                    case "mov":
                    case "mp4":
                    case "qt":
                    case "m4v":
                        self.newDiv(title, part, 'video', content, '<video controls src="' + part + '">');
                        break;
                    case 'aif':
                    case 'aiff':
                    case 'wav':
                    case 'mp3':
                        self.newDiv(title, part, 'audio', content, '<audio controls src="' + part + '">');
                        break;
                }
            }
            
            av.auto();
        });
    },
    updateNav: function(){
        // Update breadcrumbs
        var breadcrumbs = $('<div id="breadcrumbs">'),
            parts,
            url = '',
            name;
        
        if( this.current_page === undefined || this.current_page === '/' ){
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
        
        // Show position in nav tree
        $('#nav a').removeClass('current');
        $('#nav a[href="' + url + '"]').addClass('current');
    }
}