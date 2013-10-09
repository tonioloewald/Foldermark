Folder.mark 2.0
===============

Note that the features described here are the implementation target, and those marked TODO (and possibly others) are not yet implemented..

Currently the nodejs implementation is closer to the spec than the PHP version.

Key Improvements
----------------

* Rewritten for **nodejs** (**TODO**: will back port as much as possible to **PHP**)
* More work off-loaded to client-side (Javascript) means that the server-side implementation is both simpler and lighter-weight.
* Easily extensible via *Javascript* plugins
* Does not require a database
* All content is served *statically*
* Streaming (nodejs) all content is automagically streamed where appropriate
* **TODO**: **Edit your site online** effortlessly (even on mobile devices)
* Inheritance. **TODO**: stop-inherit and overriding inheritance.
* Detect file changes outside foldermark's purview and **TODO**: update internal indices automagically (changes are now
  being detected with chokidar, but corresponding adjustments to the nav_tree are not being made yet).

Setup
-----

1. Modify config.json so that the name, content_root, and port are correct for your installation.
2. "node foldermark.js"

Right now you need to kill foldermark.js and relaunch it if you modify the content on the site.

Core Concepts
-------------

Every web page is served as the same page ("effectively index.html") but with a different internal URL. Once a page is loaded, content is loaded via AJAX and the browser history is updated in code (so history should Just Work).

**The site URL is requested as fm.json inside the page directory** (e.g. "/foo/bar/" is requested as "/foo/bar/fm.json").

**fm.json comprises an array of parts of the page**. The page then renders the content on the client-side.

    [
        <string>, // e.g. "/foo/bar/image.png"
        …
    ]

The page also (once) makes a call requesting the **site map** (/site/root/fm-sitmap.json). The page uses this to render navigation links.

    {
        site_name: <string>,
        path: <string>, // site-root-relative url
        name: <string>, // automatically generated name
        contents: [
            {
                path: <string>, // site-root-relative url
                name: <string>, // automatically generated name
                contents: [
                    …
                ]
            }, …
        ]
    }

Fuzzy Link Matching
-------------------

Links are fuzzy-matched to content directories (in the PHP version) and all files (in the nodejs version). URL requests and file paths are **reduced** using the following rules:

* Leading order indicators (##_ at the beginning of file/directory names) are ignored.
* All whitespace runs are replaced with single hyphens. (So "foo   bar" -> "foo-bar".)
* **TODO**: Everything between the first and last periods in a file name are ignored. (The idea here is to make these things into "marks" for plugins, etc. to utilize without breaking links)
* Text is converted to lowercase.

E.g. 

* important page -> important-page
* 100_test case.jpg -> test-case.jpg
* test case.inherit.hidden.jpg -> test-case.jpg
* 666_FOO -> foo

When attempting to serve a page (or, in nodejs, a content file) the object whose reduced filename is **exactly matched**, if it exists, will be served. E.g. /10_foo/20_bar baz -> /foo/bar-baz -- a page whose reduced name exactly matches this will be served; it could be /10_foo/20_bar baz, but it could also be /37_foo/bar-baz.


###TODO: automatic handling of broken links resulting from major site reorganization

Failing this, any file whose **reduced name matches the beginning of the requested page** (or content file) will be served. E.g. if the the page /foo/bar/baz is requested but does not exist, /foo/bar might be returned instead.

If no match of either kind is found, in the case of a **page**, the path will be broken into parts and the closest match will be returned. In the case of file, a 404 will be returned. Closest match is defined as:

* Each path component matched is worth 10^(n-1) points where the component is the nth part of the requested url. E.g. foo/bar/baz will award 100 points for files matching baz, 10 points for bar, and 1 point for foo. TODO: tie resolution.


Inheritance
-----------

Any file or folder whose name has the word .inherit before its type extension (or the end of its name), e.g. foo.inherit.js or bar.inherit.css or baz.inherit, will be loaded into all subpages.

To block an inherited file from an ancestor page, you can override it with another identically named file or cancel it using .stop-inherit (e.g. foo.stop-inherit.js will prevent foo.inherit.js from being inherited).

HTML Fragment Injection
-----------------------

When a page component is html it will be loaded asynchronously and then injected into the right place in the page. If it has script tags, these will be executed as anonymous functions in the context of the root node. (If the html fragment is a complete page, then the root node will be a div that replaces the body tag; otherwise, the root node will be the root node in the fragment if there is one, and a div node containing the nodes in the fragment otherwise.)

E.g.

    <div>
        <h2>Hello World</h2>
        <p>This is a paragraph.</p>
    </div>
    <script>
        // this points to the div (because it's the root node);
        $(this).append('And hello from jQuery'); // jQuery is loaded by default
    </script>

Plugins
-------

**TODO**: needs examples, e.g. blog, slideshow, carousel or custom video player.

To add custom code to a page, simply put the javascript file in a folder. If you want the file to appear in every sub-page, add .inherit (before .js) in its name, so myplugin.inherit.js will load into all subpages of the page in which it appears.

If files or folders are given a custom extension (e.g. .slideshow) then the url will appear in the contents directory. Your custom javascript plugin can do with this what it will. If your plugin makes a service call against the url it will get the content of the file and a JSON manifest of a directory (e.g. if you put pictures in "vacation.slideshow" you'd get back an array of urls of the images inside).

TODO: Admin Access
------------------

Admin Access is controlled by a simple JSON file named users.json (this file is outside the content tree!). If no users.json file is present, then the only way to edit pages is by modifying files on the server directly.

**users.json** file looks like this:

    [
        {
            username: <username-string>, // anything you like
            password: <password-checksummed>, // md5 checksummed password
            privileges: <array-of-privileges> // see below
        }
    ]

## The **privileges** are:

* **access-control** user can create users and grant write privileges
* **global-edit** user can modify any page
* paths (always start with "/") user can modify specified path and anything below it

Note that paths always start with a "/" and other privileges (so far, only two of them) never do. This prevents a user without access-control (or similar) privileges from privilege escalation.

### Logging In

To log in as admin a user simply appends #admin to any url and a login UI will appear. Once the user is logged in, their status is tracked by cookies. Note that this will work for both standard urls such as site.com/foo/bar and hashtag urls such as site.com/#foo/bar.


