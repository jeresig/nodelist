(function() {
	if ( document.createNodeList ) {
		return;
	}
	
	var toString = Object.prototype.toString,
		splice = Array.prototype.splice,
		slice = Array.prototype.slice,
		push = Array.prototype.push,
		compareDocumentPosition = document.documentElement.compareDocumentPosition,
		hasDuplicate = false,
		doc = typeof HTMLDocument === "undefined" ? document : HTMLDocument.prototype,
		
		// This outputs 4 (Node is before the other node) in WebKit,
		// even though it should output 1 (Nodes are disconnected)
		findDisconnect = document.createElement("a")
			.compareDocumentPosition( document.createElement("b") ) & 1;
	
	// Node
	
	if ( typeof Node === "undefined" ) {
		Node = function(){};
	}
	
	Node.NODELIST_NODE = 13;
	
	// Document
	
	doc.createNodeList = createNodeList;
	
	// NodeList

	function InternalNodeList() { }
	
	extend( "nodeType", Node.NODELIST_NODE );
		
	extend( "createNodeList", function() {
		return createNodeList.apply( this, arguments );
	});
		
	// Array extras

	extend( "toArray", function() {
		return Array.prototype.slice.call( this, 0 );
	});

	if ( Array.prototype.filter ) {
		extend( "filter", function() {
			if ( this.secured && isFunction( arguments[0] ) ) {
				var fn = arguments[0], self = this;

				arguments[0] = function( elem, pos, all ) {
					return fn.call( this, null, pos, self );
				};
			}

			return this.createNodeList(
				Array.prototype.filter.apply( this.secured || this, arguments ),
				"filter", arguments );
		});
	}
	
	extend( "slice", function( fn ) {
		return this.createNodeList(
			Array.prototype.slice.apply( this.secured || this, arguments ),
			"slice", arguments );
	});

	var extra = [ "reduce", "reduceRight", "some", "every" ];
	
	for ( var i = 0; i < extra.length; i++ ) (function( name ) {
		if ( Array.prototype[ name ] ) {
			extend( name, function( fn ) {
				return Array.prototype[ name ].apply( this, arguments );
			});
		}
	})( extra[i] );
	
	var extraPlain = [ "indexOf", "lastIndexOf" ];
	
	for ( var i = 0; i < extraPlain.length; i++ ) (function( name ) {
		if ( Array.prototype[ name ] ) {
			extend( name, function( fn ) {
				return Array.prototype[ name ].apply( this.secured || this, arguments );
			});
		}
	})( extraPlain[i] );

	// Difference from Arrays:
	// Non-nodes are filtered out
	if ( Array.prototype.map ) {
		extend( "map", function( fn ) {
			return this.createNodeList(
				Array.prototype.map.apply( this, arguments ).filter( isNode ),
				"map", arguments );
		});
	}
	
	// Difference from Arrays:
	// Returns the NodeList
	if ( Array.prototype.forEach ) {
		extend( "forEach", function( fn ) {
			Array.prototype.forEach.apply( this, arguments );

			return this;
		});
	}
	
	// Difference from Arrays:
	// Can accept non-arrays (NodeList, HTMLCollection, object)
	extend( "concat", function( other ) {
		return this.createNodeList(
			slice.call( this.secured || this, 0 )
				.concat( slice.call( other.secured || other, 0 ) ),
			"concat", arguments );
	});

	// Selectors API

	var selectors = [ "querySelectorAll", "queryScopedSelectorAll" ];

	for ( var i = 0; i < selectors.length; i++ ) (function( name ) {
		var method = Element.prototype[ name ], other = "__" + name;

		if ( method ) {
			extend( name, function( selector ) {
				var elems = this.secured || this, cur = elems.toArray();

				for ( var i = 0, l = elems.length; i < l; i++ ) {
					cur = cur.concat( elems[i][ name ]( selector ) );
				}

				return this.createNodeList( cur, name, arguments );
			});
		}
	})( selectors[i] );

	var matches = Element.prototype.matchesSelectors ||
		Element.prototype.mozMatchesSelector ||
		Element.prototype.webkitMatchesSelector;

	if ( matches ) {
		extend( "matchesSelector", function( selector ) {
			return (this.secured || this).some(function( elem ) {
				return matches.call( elem, selector );
			});
		});

		extend( "filterSelector", function( selector ) {
			return (this.secured || this).filter(function( elem ) {
				return matches.call( elem, selector );
			});
		});
	}

	// Event API

	var events = [ "addEventListener", "removeEventListener", "dispatchEvent" ];

	for ( var i = 0; i < events.length; i++ ) (function( name ) {
		if ( Element.prototype[ name ] ) {
			extend( name, function() {
				var elems = this.secured || this;

				for ( var i = 0, l = elems.length; i < l; i++ ) {
					Element.prototype[ name ].apply( elems[i], arguments );
				}

				return this;
			});
		}
	})( events[i] );

	// Live

	// TODO: requery on native methods
	//   querySelectorAll
	//   queryScopedSelectorAll

	extend( "requery", function() {
		return this;
	});

	// Security

	extend( "secure", function() {
		var old = this, secure = this.createNodeList(),
			props = InternalNodeList.prototype;

		// Intentionally set 'null' for the element values
		for ( var i = 0, l = old.length; i < l; i++ ) {
			secure[ i ] = null;
		}

		// Keep the original length (no harm in that)
		secure.length = old.length;

		// Remove the parent NodeList reference
		secure.parentNodeList = this.secured ? this : null;

		// NOTE: Property should be set internally, not exposed
		secure.secured = old;

		return secure;
	});
	
	function extend( prop, value ) {
		if ( typeof NodeList !== "undefined" ) {
			NodeList.prototype[ prop ] = value;
		}
	
		if ( typeof HTMLCollection !== "undefined" ) {
			HTMLCollection.prototype[ prop ] = value;
		}
	
		InternalNodeList.prototype[ prop ] = value;
	}

	function isFunction( fn ) {
		return fn != null && toString.call(fn) === "[object Function]";
	}
	
	function createNodeList( nodes, reName, reArgs ) {
		if ( arguments.length > 0 &&
			(nodes == null || typeof nodes.length !== "number" || typeof nodes !== "object" &&
				// Additional checks to make sure WebKit is handled correctly
				toString.call(nodes) !== "[object NodeList]" &&
				toString.call(nodes) !== "[object HTMLCollection]") ) {
			throw new Error("Incorrect argument: " + nodes + " " + (typeof nodes));
		}

		var nodeList = new InternalNodeList(), node,
			buckets = [], b, bl, bucket, inserted, pos;

		nodeList.length = 0;

		if ( nodes ) {
			nodes = nodes.secured || nodes;

			for ( var i = 0, l = nodes.length; i < l; i++ ) {
				node = nodes[i];

				// All incoming nodes must be actual nodes
				if ( !isNode( node ) ) {
					throw new Error("Incorrect node in position " + i + ": " + node);
				}
				
				bl = buckets.length;
				
				// Break the nodes into buckets
				inserted = false;
				
				// Find the right bucket
				for ( b = 0; b < bl; b++ ) {
					bucket = buckets[b];
					pos = compareDocumentPosition.call( node, bucket[0] );
					
					// Nodes aren't disconnected from one another
					if ( findDisconnect || !(pos & 4) ? !(pos & 1) : !areDisconnected( node, bucket[0] ) ) {
						// It's before the first node
						if ( pos & 4 ) {
							bucket.unshift( node );
						
						// Otherwise, if it's not a duplicate of the first node
						} else if ( pos ) {
							for ( var bb = 1, bbl = bucket.length; bb < bbl; bb++ ) {
								pos = compareDocumentPosition.call( node, bucket[bb] );
								
								if ( pos & 2 ) {
									bucket.splice( bb, 0, node );
								}
								
								if ( pos & 2 || !pos ) {
									inserted = true;
									break;
								}
							}
							
							if ( !inserted ) {
								bucket.push( node );
							}
						}
						
						inserted = true;
						break;
					}
				}
				
				if ( !inserted ) {
					buckets.push( [ node ] );
				}
			}
			
			for  ( b = 0, bl = buckets.length; b < bl; b++ ) {
				push.apply( nodeList, buckets[b] );
			}
		}

		nodeList.parentNodeList = this;

		if ( this.secured ) {
			nodeList = nodeList.secure();

			// Point to the parentNodeList if it's secure
			nodeList.parentNodeList = this.secured ? this : null;
		}

		if ( nodeList.parentNodeList ) {
			nodeList.requery = function() {
				return this[ reName ].apply( this.parentNodeList.requery(), reArgs );
			};
		}
		
		return nodeList;
	}
	
	function isNode( node ) {
		return !!(node && (typeof Node === "function" ?
			node instanceof Node :
			node.nodeType));
	}
	
	function areDisconnected( a, b ) {
		var curA = a.parentNode, curB = b.parentNode;
		
		if ( !curA || !curB ) {
			return true;
		}
		
		while ( curB && curB.nodeType === 1 ) {
			if ( curB.contains( a ) ) {
				return false;
			}
			curB = curB.parentNode;
		}
		
		return true;
	}
	
	if ( !compareDocumentPosition ) {
		if ( "sourceIndex" in document.documentElement ) {
			compareDocumentPosition = function( b ) {
				var ai = this.sourceIndex, bi = b.sourceIndex;
				
				// TODO: We have to manually walk the tree
				if ( false && (!ai || !bi) ) {
					var cur;
					
					while ( ai.previousSibling ) {
						
					}
				}
				
				if ( this === b ) {
					return 0;
				} else if ( ai === -1 || bi === -1 ) {
					return 0x01;
				} else if ( b.contains( this ) ) {
					return 0x10;
				} else if ( this.contains( b ) ) {
					return 0x08;
				} else if ( ai < bi ) {
					return 0x04;
				} else if ( ai > bi ) {
					return 0x02;
				}
			};
		}
	}
})();
