# NodeList API Proposal

## document.createNodeList( ArrayLikeObjectOfNodes )

Returns a NodeList, contains nothing but nodes, any non-nodes are discarded. Any nodes coming from an external document are discarded. All nodes are sorted in document order with duplicates removed. Additionally all NodeLists created with this method are static as a result.

	document.createNodeList( document.documentElement.childNodes ) // Live NodeList
	document.createNodeList( document.getElementsByTagName("div") ) // HTMLCollection
	document.createNodeList( document.querySelectorAll("div" ) ) // Static NodeList
	document.createNodeList( [ document.body ] )
	document.createNodeList( { "0": document.body, length: 1 } )
	document.createNodeList() // .length = 0

How to sort nodes with mixed fragments:

#### Disconnected:

	<div id="nodeFragA0">
		<div id="nodeFragA1"></div>
	</div>

#### In document:

	<div id="nodeFragB0"></div>

#### Disconnected:

	<div>
		<div id="nodeFragC0"></div>
		<div id="nodeFragC1"></div>
	</div>

	document.createNodeList([ nodeFragB0, nodeFragA0, nodeFragC1, nodeFragC0, nodeFragA1 ])
		// => [ nodeFragB0, nodeFragA0, nodeFragA1, nodeFragC0, nodeFragC1 ]

Nodes within fragments are ordered by the location of the first node from a fragment found. Nodes from the same fragment are then sorted together, in document order. The results should be reproducible.

In short: Sort nodes from the same fragment, don't sort the fragments against each other, leave them in their original order.

**Status:** Standards-compatible sample implementation exists along with tests.

## Ensure: HTMLCollection inherits from NodeList

OR just kill off HTMLCollection in favor of NodeList. (Currently HTMLCollection does not inherit from NodeList.)

**Status:** Standards-compatible sample implementation exists along with tests.

## NodeList implements the NodeSelector interface

(NodeList gets querySelectorAll, queryScopedSelector, and matchesSelector.)

queryScopedSelector(All) is self-explanatory (return a new resulting NodeList that's the aggregate of the collections).

matchesSelector returns true if any nodes match the selector (jQuery does this right now with .is).

**Status:** Standards-compatible sample implementation exists. Tests are work-in-progress.

## New Method: NodeList.prototype.filterSelector( selector )

Returns a NodeList that is filtered by the selector. Equivalent to doing:

	nodelist.filter(function( elem ){
		return elem.matchesSelector( selector );
	});

**Status:** Sample implementation exists along with tests.

## NodeList implements the EventTarget interface

(NodeList gets addEventListener, removeEventListener, and dispatchEvent.)

Methods work as normal, pass-through to the nodes contained within the list.

	nodelist.forEach(function( elem ){
		return elem.addEventListener( "click", function(){}, false );
	});

**Status:** Standards-compatible sample implementation exists. Tests are work-in-progress.

## Ensure: NodeList gets Array methods and Array extras.

* Returns value: indexOf, lastIndexOf, reduce, reduceRight, some, every
* Returns current NodeList: forEach
* Returns a new NodeList: filter, map, slice, concat

Note: No destructive methods are included.

**Status:** Standards-compatible sample implementation exists along with tests.

## NodeList.prototype.createNodeList

Creates a NodeList whose parentNodeList is equal to the originating NodeList. Uses the same .ownerDocument. Additionally any methods that exist on NodeList.prototype should create their NodeList rooted at the base NodeList.

	var div = document.querySelectorAll("div");
	var span = div.querySelectorAll("span");
	div === span.parentNodeList // The collection of divs

**Status:** Standards-compatible sample implementation exists along with tests.

## NodeList.prototype.requery

Return a new NodeList based upon the previous query, updated to match the current state of the DOM. The requery method should also run the requery method of the parentNodeList NodeList so that a full stack update occurs.

It's up to the individual methods to provide implementations for this, by default the implementation is equivalent to:

	NodeList.prototype.requery = function() {
		return this.parentNodeList.requery();
	};

The native methods should have an implementation, at least (for Document, DocumentFragment, and Element):

	var oldQSA = Document.prototype.querySelectorAll;
	
	Document.prototype.querySelectorAll = function( selector ) {
		var ret = oldQSA.call( this, selector );
		ret.requery = function() {
			return this.querySelectorAll( selector );
		};
		return ret;
	};

#### Example:

	var divs = document.querySelectorAll("div");
	divs.length === 0;
	
	document.body.appendChild( document.createElement("div") );
	divs.length === 0;
	
	divs = divs.requery();
	divs.length === 1;

**Status:** Standards-compatible sample implementation exists along with tests.

## Live Updates: .added( function ), .removed( function )

The added and removed callback functions execute whenever a node is inserted or removed from the NodeList. The check is done by running the requery() method of the NodeList until an update occurs, compared to the original NodeList. The rate at which the query occurs is left up to the useragent (thus can be handled asynchronously).

#### Example:

	document.querySelectorAll("div")
		.forEach( setClass )
		.added( setClass );

	function setClass( elem ) {
		elem.className = "found";
	}

It would be easy to implement a forEach that runs live across all nodes found:

	NodeList.prototype.live = function( fn ) {
		return this.forEach( fn ).added( fn );
	};
	
	document.querySelectorAll("div").live(function( elem ) {
		elem.className = "found";
	});

This is a replacement for DOM mutation events and <a href="http://www.w3.org/2008/webapps/wiki/MutationReplacement#NodeWatch_.28A_Microsoft_Proposal.29">the proposal from Microsoft</a>.

**Discussion:** This particular solution is much more powerful than the the current DOM mutation events specified in browsers and doesn't block execution flow. Granted the additional asynchronous execution of JavaScript may cause additional overhead in applications that may be difficult to quantify.

Status: This is an open proposal and further discussion is warranted.

## Security: .secure()

The secure method returns a NodeList that has been crippled in a few critical ways:

* All user-accessible nodes have been replaced with null instead (the length property and value are left intact).
* The parentNodeList property has been set to null.
* All methods that accept callback functions no longer receive elements as arguments (null is passed in, instead).
* All methods that return new NodeLists are also secured by default (although their parentNodeList is still intact).

Note that all the NodeList methods provided by the useragent still have access to the actual nodes contained within the NodeList. Thus the following will work:

	var div = document.querySelectorAll("div").secure();
	div.length === 2;
	div[0] === null;
	div[1] === null;
	
	div = div.slice(1);
	div.length === 1;
	
	var span = div.querySelectorAll("span");
	span.length === 3;

**Discussion:** There are no additional security implications with the methods specified in the additional draft - however there likely would be if other methods were added (such as the ability to traverse to parent or sibling nodes - or the ability to change CSS styling). Thus there will need to be some discussion regarding whitelisting/blacklisting certain methods on secured NodeLists.

**Status:** Standards-compatible sample implementation exists along with tests.

# Also: Fix the Selectors API

## .matchesSelector( selector )

See: <a href="https://bugs.webkit.org/show_bug.cgi?id=29703">webkitMatchesSelector</a>, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=518003">mozMatchesSelector</a>, and msieMatchesSelector in IE 9.

**Current state:** JavaScript libraries implement this but it's quite slow compared to what it could be.

## .queryScopedSelector( selector ), .queryScopedSelectorAll( selector )

Alternative methods to querySelector(All) that work scoped based upon the root node.

#### Example:

	<div id="test">
	  <div id="test2"></div>
	</div>
	<script>
	document.getElementById("test").queryScopedSelector( "div div" ).length === 0;
	</script>

Having it be a separate set of methods makes it easy to feature detect and use (custom selectors like :scope make it hard to test properly, need to do try/catch and the like).

An exception is thrown when +/~/&gt; are used at the front of the selector.

**Current state:** Libraries either punt on the issue or use horrible hacks.