/*
    Foldermark Client-Side Code
    ===========================
    
    Page Part Name
    
    [ <ORDERING>_ ] human-readable-name [.<CLASS>] .<TYPE>
    
    - Ordering is concealed by the service (it determines the order the files are placed in)
    
    TODO
    ----
    
    Allow a page part to elect to create a new section with a specified template
    Support "plugins" that can handle specified classes of page or sub-page
*/

var fm = {
    current_page: false,
    sitemap: false,
    section: $('#main > .section').empty().detach(),
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
            var nav = $('.nav');
            
            // console.log( 'sitemap', sitemap );
            self.sitemap = sitemap;
            
            $("<a>")
                .attr('href', '/')
                .text(sitemap.name)
                .appendTo('.home');
            
            nav.empty().append( render_page_link( sitemap ) );
            
            self.updateNav();
        });
    },
    newDiv: function(title, part, type, target, html){
        var section = this.section.clone()
                    .addClass(type)
                    .appendTo(target),
            div = $('<div>').appendTo(section);
        if( html ){
            div.html(html);
        }
        return div;
    },
    loadPage: function(url, doNotPush){
        var converter = this.converter,
            self = this;
        
        if( !this.current_page ){
            this.initPage();
        }
        
        if( typeof url === 'string' && url.substr(-1) !== '/' ){
            url += '/';
        }
        
        if( url === this.current_page ){
            return;
        }
        
        $.getJSON( url + 'fm.json', function(parts){
            var content = $('#main').empty(),
                loc = window.location,
                new_url = loc.protocol + '//' + loc.host + url;
        
            if( !doNotPush ){
                // console.log( 'pushing', new_url );
                window.history.pushState({ url: url }, '', new_url);
            }
            
            // console.log('received part', url);
            self.current_page = url;
            self.updateNav();
            
            $('body link').remove();
            
            for( var i = 0; i < parts.length; i++ ){
                var part = parts[i],
                    type = part.match(/\.([\w\-_]*)$/),
                    node,
                    title = part.split('/').pop().split('.').shift(),
                    divClass = [].concat(part.match(/\.(\w*)\.[^\.]*$/)).pop();
                
                type = type === null ? undefined : type[1];
                switch( type ){
                    /* images */
                    case "gif":
                    case "jpg":
                    case "jpeg":
                    case "png":
                        self.newDiv(title, part, divClass || 'image', content, '<img alt="' + title + '" src="' + part + '">');
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
                                    text = text.replace(/\-\-/g, '&mdash;');
                                    node.html( converter.makeHtml(text) );
                                }
                            });
                        })(self.newDiv(title, part, divClass || 'markdown', content));
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
                        })(self.newDiv(title, part, divClass || 'html', content));
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
                        self.newDiv(title, part, divClass || 'download', content, '<p>Download <a href="' + part + '">' + title + '</a></p>');
                        break;
                    case "mov":
                    case "mp4":
                    case "qt":
                    case "m4v":
                        self.newDiv(title, part, divClass || 'video', content, '<video controls src="' + part + '">');
                        break;
                    case 'aif':
                    case 'aiff':
                    case 'wav':
                    case 'mp3':
                        self.newDiv(title, part, divClass || 'audio', content, '<audio controls src="' + part + '">');
                        break;
                }
            }
            
            av.auto();
        });
    },
    updateNav: function(){
        // Update breadcrumbs
        var breadcrumbs = $('<div>'),
            parts,
            url = '',
            name;
        
        // if the sitemap loads before the initial page load, current_page will be undefined
        if( this.current_page === false || this.current_page === undefined || this.current_page === '/' ){
            parts = [''];
        } else {
            // animate scroll to top
            $('html,body').animate({ scrollTop: 0 }, 500);
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
        
        $('title').text(name.replace(/(^|[\-_])(\w)(\w+)/g, function(match, p1, p2, p3){
            var word = p2 + p3;
            /*
            non-capitalized words in titles (English) 
            based on US Government Printing Office Style Manual
            http://grammar.yourdictionary.com/capitalization/rules-for-capitalization-in-titles.html
            http://www.gpo.gov/fdsys/search/pagedetails.action?granuleId=&packageId=GPO-STYLEMANUAL-2008&fromBrowse=true
            */
            if(!word.match(/^(a|an|the|at|by|for|in|of|on|to|up|and|as|but|it|or|nor)$/)){
                word = p2.toUpperCase() + p3;
            }
            if(p1 !== ''){
                word = ' ' + word;
            }
            return word;
        }));
        
        $('.breadcrumbs').empty();
        breadcrumbs.contents().appendTo('.breadcrumbs');
        
        // Show position in nav tree
        $('.nav a').removeClass('current');
        $('.nav a[href="' + url + '"]').addClass('current');
    }
}