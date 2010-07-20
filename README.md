
# First: Fix the Selectors API

## .matchesSelector( selector )

See: <a href="https://bugs.webkit.org/show_bug.cgi?id=29703">webkitMatchesSelector</a>, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=518003">mozMatchesSelector</a>.

Current state: JavaScript libraries implement this but it's quite slow compared to what it could be.

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

Concession: Throw an exception when +/~/&gt; are used at the front of the selector.

Current state: Libraries either punt on the issue or use horrible hacks.

# NodeList

## document.createNodeList( ArrayLikeObjectOfNodes )

Returns a NodeList, contains nothing but nodes, any non-nodes are discarded. Any nodes coming from an external document are discarded. All nodes are sorted in document order with duplicates removed.

	document.createNodeList( document.documentElement.childNodes ) // NodeList
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

Current state: Have to use horribly slow sorting and uniquing techniques (see code at the bottom). This is used frequently in order to ensure that methods will always return sets of nodes in document order (and without duplicates). (See Bottom Example)

## NodeList.prototype.concat( otherNodeList )

Merging NodeLists would be hard, as is, this would be one way to achieve this.

Current state: Merging collections suffers from the same problem as listed before (sorting, uniquing).

## Ensure: NodeList, StaticNodeList, HTMLCollection all inherit from NodeList

(Currently HTMLCollection does not inherit from NodeList.)

Current state: Libraries write a variety of methods that work against collections of elements. Ensuring that NodeList (and NodeList-like things) can be re-used in a graceful manner will ensure their ability to be easily extended.

## NodeList also implements the NodeSelector interface

(NodeList gets querySelector, querySelectorAll, etc. and matchesSelector.)

querySelector/queryScopedSelector(All) methods are self-explanatory (return a new resulting NodeList that's the aggregate of the collections).

What should matchesSelector return? True if all nodes match the selector OR True if any nodes match the selector (jQuery does this right now with .is).

Current state: Libraries write methods for doing sub-selections off of sets of collections, would be great to have this be codified.

## Ensure: NodeList gets Array extras.

Returns number: indexOf, lastIndexOf

Returns a new NodeList: every, filter, forEach, map, some, reduce, reduceRight, slice, concat

Current state: Libraries write these methods, or one-offs of these methods, for node collections all the time.

## NodeList.prototype.filterSelector( selector )

Returns a NodeList that is filtered by the selector. Equivalent to doing:

	nodelist.filter(function( elem ){
	    return elem.matchesSelector( selector );
	});

Current state: Libraries provide a method for reducing a collection of nodes - this would likely be one of the first methods that is implemented.

## NodeList.prototype.createNodeList

Creates a NodeList whose parentNodeList is equal to the originating NodeList. Uses the same .ownerDocument. Additionally any methods that exist on NodeList.prototype should create their NodeList rooted at the base NodeList.

#### Example:

	document.querySelectorAll("div")
	    .querySelectorAll("span").parentNodeList // The collection of divs

Current state: Libraries implement 'chaining', this would make it feasible and integrated into the environment.

## NodeList.prototype.query

Return a new NodeList based upon the previous query, updated to match the current state of the DOM. The query method should also run the query method of the parentNodeList NodeList so that a full stack update occurs.

It's up to the indvidual methods to provide implementations for this, by default the implementation is equivalent to:

	NodeList.prototype.query = function() {
	    return this.parentNodeList.query();
	};

The native methods should have an implementation, at least (do for document, documentfragment, and element):

	var oldQSA = Document.prototype.querySelectorAll;

	Document.prototype.querySelectorAll = function( selector ) {
	    var ret = oldQSA.call( this, selector );
	    ret.query = function() {
	        return this.parentNodeList.query().querySelectorAll( selector );
	    };
	    return ret;
	};

#### Example:

	var divs = document.querySelectorAll("div");
	divs.length === 0;

	document.body.appendChild( document.createElement("div") );
	divs.length === 0;

	divs = divs.query();
	divs.length === 1;

Presumably if you're making a number of methods that will be re-queryable it make a lot of sense to build an easy method for simplifying that process:

	NodeList.prototype.setQuery = function( array, name, args ) {
	    var self = this.createNodeList( array );
	    self.query = function(){
	        return this[ name ].apply( this.parentNodeList.query(), args );
	    };
	    return self;
	};

## NodeList.prototype.addEventListener( type, callback ), NodeList.prototype.removeEventListener( type, callback )

to which two events will be relevant: "added" and "removed"

The added and removed events fire whenever a node is inserted or removed from the NodeList. The check is done by running the query() method of the NodeList until an update occurs, compared to the original NodeList. The rate at which the query occurs is left up to the useragent.

#### Example:

	document.querySelectorAll("div")
	  .forEach( setClass )
	  .addEventListener( "added", setClass );

	function setClass( elem ) {
	    (elem.target || elem).className = "found";
	}

It would be easy to implement a forEach that runs live across all nodes found:

	NodeList.prototype.live = function( fn ) {
	    return this.forEach( fn ).addEventListener( "added", function( evt ) {
	        fn.call( this, evt.target );
	    });
	};

#### Example:

	document.querySelectorAll("div").live(function( elem ) {
	    elem.className = "found";
	});

This is a replacement for DOM mutation events and <a href="http://www.w3.org/2008/webapps/wiki/MutationReplacement#NodeWatch_.28A_Microsoft_Proposal.29">the proposal from Microsoft</a>.