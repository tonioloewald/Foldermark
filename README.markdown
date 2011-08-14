folder.mark -- The Instant CMS
==============================

Note: this file is formatted using markdown.

How to use folder.mark in Five Minutes
--------------------------------------

1. Copy the folder.mark directory onto your web server. 
	(You can [download folder.mark here](https://github.com/tonioloewald/Foldermark).)
	It requires __PHP5__ (so if you need to do some .htaccess stuff to force PHP5 to be 
	used, you'll need to do that).

2. In the folder you want to serve as your web-root add a .htaccess file. It needs to have this stuff in it:

	<pre>
	Options +FollowSymLinks 
	RewriteEngine On
	
	RewriteRule ^([^\.]*)$ <b>/path/to/folder.mark/</b>?h=site_name=<b>/path/to/content/</b>&u=$1 [NC]
	</pre>
	
	__Note__: both paths are web-root relative.

3. Organize content in your content folder using sub-folders and whatever.

	__Note__: by and large, things should work as expected. The key thing to understand is that,
	by default, a folder equals a web page. If you want to re-order content in a directory you
	can prefix names using XXX_name and the XXX_ part will be used for ordering but not displayed.

4. Spend the remaining three or four minutes congratulating yourself on a job well-done.

Why Use folder.mark?
-------------------

__It does more than any other CMS.__

* If you just read the preceding section, you know how to use it.
* Create arbitrary page layouts any way you like.
* Generates very spare HTML5 source, with just enough hooks to hang your CSS off.
* Finding, organizing, and reorganizing stuff is trivial.
	* And urls are fuzzy-matched so content doesn't get lost (planned)
* It gives you nice URLs with no work (planned)
* You can use Markdown, XML, or HTML -- whatever floats your boat.
* It cleanly separates code from content.
* It doesn't need a database back-end.
* Pages __print nicely__ out of the box.
* [less](http://lesscss.org/) (compiled css) is supported transparently.

__It does less than any other CMS.__

* It's incredibly simple.
* It's easy to extend both "properly" and ad-hoc.
* It gets out of your way.
	* Working on allowing URL parameters ('GET') "through" (planned) to your code
	
How folder.mark Builds Pages
----------------------------

folder.mark treats each folder (or directory if you prefer) in your content folder as a web page. 
(Anything with a leading period is ignored, as are folders named "images" or "assets".) To convert
a folder into a web page, it:

1. Finds everything in the folder.
2. Sticks the css (and less) files up top
3. Inserts navigation stuff (which you can easily hide or format with css)
4. Sticks the content parts in the middle (rendering them as necessary)
5. Sticks the javascript down the bottom

Items are output in alphabetical order by filename, but item names omit anything before the first
underscore separater, so if you want "foo.txt" to appear before "alpha.txt", renaming it to "0_foo" will
do the trick (and it will still appear as "foo".

(The underlying idea is the "0_foo bar baz" will appear as "foo bar baz" and have the URL "foo-bar-baz"
and the link will keep on working if you change the name to "2_foo bar baz". The last bit hasn't
been implemented yet.)
