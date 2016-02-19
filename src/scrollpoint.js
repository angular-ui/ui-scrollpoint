/**
 * Adds a 'ui-scrollpoint' class to the element when the page scrolls past it's position.
 * @param [offset] {int} optional Y-offset to override the detected offset.
 *   Takes 300 (absolute) or -300 or +300 (relative to detected)
 */
angular.module('ui.scrollpoint', []).directive('uiScrollpoint', ['$window', '$timeout', function ($window, $timeout) {

        function getWindowScrollTop() {
            if (angular.isDefined($window.pageYOffset)) {
                return $window.pageYOffset;
            } else {
                var iebody = (document.compatMode && document.compatMode !== 'BackCompat') ? document.documentElement : document.body;
                return iebody.scrollTop;
            }
        }
        function getWindowScrollHeight() {
            return ($window.document.body.scrollHeight - $window.innerHeight);
        }
        function getWindowHeight(contentHeight) {
            return (contentHeight ? $window.document.body.clientHeight : $window.innerHeight);
        }
        return {
            require: ['uiScrollpoint', '^?uiScrollpointTarget'],
            controller: function(){
                var self = this;
                this.$element = undefined;
                this.$target = undefined;
                this.hasTarget = false;

                this.hit = undefined;
                this.edges = { top: { top: true }}; // ui-scrollpoint on top edge of element with top edge of target
                this.hitEdge = undefined;

                this.default_edge = {
                    absolute: false,
                    percent: false,
                    shift: 0
                };
                this.posCache = {};

                this.ready = false;
                this.enabled = true;
                
                this.scrollpointClass = 'ui-scrollpoint';
                this.actions = undefined;

                function parseScrollpoint(scrollpoint){
                    var def = { shift: 0, absolute: false, percent: false };
                    if(scrollpoint && angular.isString(scrollpoint)) {
                        def.percent = (scrollpoint.charAt(scrollpoint.length-1) == '%');
                        if(def.percent) {
                            scrollpoint = scrollpoint.substr(0, scrollpoint.length-1);
                        }
                        if(scrollpoint.charAt(0) === '-') {
                            def.absolute = def.percent;
                            def.shift = -parseFloat(scrollpoint.substr(1));
                        }
                        else if(scrollpoint.charAt(0) === '+') {
                            def.absolute = def.percent;
                            def.shift = parseFloat(scrollpoint.substr(1));
                        }
                        else {
                            var parsed = parseFloat(scrollpoint);
                            if (!isNaN(parsed) && isFinite(parsed)) {
                                def.absolute = true;
                                def.shift = parsed;
                            }
                        }
                    }
                    else if(angular.isNumber(scrollpoint)){
                        return parseScrollpoint(scrollpoint.toString());
                    }
                    return def;
                }

                this.addEdge = function(view_edge, element_edge){
                    if(angular.isString(view_edge)){
                        if(angular.isUndefined(element_edge)){
                            element_edge = true;
                        }
                        if(view_edge == 'view'){
                            // view is a shorthand for matching top of element with bottom of view, and vice versa
                            this.addEdge('top', 'bottom');
                            this.addEdge('bottom', 'top');
                        }
                        else{
                            var edge, parsedEdge;
                            if(angular.isObject(element_edge)){
                                // the view_edge interacts with more than one element_edge
                                for(edge in element_edge){
                                    // parse each element_edge definition (allows each element_edge to have its own scrollpoint with view_edge)
                                    if(element_edge[edge] === true){
                                        element_edge[edge] = true; // use the ui-scrollpoint default
                                    }
                                    else{
                                        element_edge[edge] = parseScrollpoint(element_edge[edge]);
                                    }
                                }
                            }
                            else if(element_edge == 'top' || element_edge == 'bottom'){
                                // simple top or bottom of element with 0 shift
                                edge = element_edge;
                                parsedEdge = parseScrollpoint();
                                element_edge = {};
                                element_edge[edge] = parsedEdge;
                            }
                            else if(element_edge === true){
                                element_edge = {};
                                element_edge[view_edge] = true; // use the ui-scrollpoint default
                            }
                            else{
                                // element_edge matches view_edge (ie. top of element interacts with top of view)
                                parsedEdge = parseScrollpoint(element_edge);
                                element_edge = {};
                                element_edge[view_edge] = parsedEdge;
                            }
                            // element_edge has been parsed
                            this.edges[view_edge] = element_edge;
                        }
                    }
                };

                this.addAction = function(action){
                    if(action && angular.isFunction(action)){
                        if(angular.isUndefined(this.actions)){
                            this.actions = [action];
                        }
                        else if(this.actions.indexOf(action) == -1){
                            this.actions.push(action);
                        }
                    }
                };

                this.setScrollpoint = function(scrollpoint){
                    this.default_edge = parseScrollpoint(scrollpoint);
                };

                this.setClass = function(_class){
                    if(!_class){
                        _class = 'ui-scrollpoint';
                    }
                    this.scrollpointClass = _class;
                };

                this.setEdges = function(edges){
                    // normalize uiScrollpointEdge into edges structure
                    //  edges = { ['screen_edge'] : ['element_edge' | true] }
                    if(angular.isString(edges)){
                        this.edges = {};
                        this.addEdge(edges);
                    }
                    else if(angular.isArray(edges)){
                        this.edges = {};
                        for(var i=0; i < edges.length; i++){
                            this.addEdge(edges[i]);
                        }
                    }
                    else if(angular.isObject(edges)){
                        this.edges = {};
                        for(var edge in edges){
                            this.addEdge(edge, edges[edge]);
                        }
                    }
                    else{
                        // default
                        this.edges = {};
                        this.addEdge('top');
                    }
                };

                this.setElement = function(element){
                    this.$element = element;
                };

                this.setTarget = function(target){
                    if(target){
                        this.$target = target;
                        this.hasTarget = true;
                    }
                    else{
                        this.$target = angular.element($window);
                        this.hasTarget = false;
                    }
                };

                this.getEdge = function(scroll_edge, element_edge){
                    if(scroll_edge && element_edge){
                        if(this.edges[scroll_edge] && this.edges[scroll_edge][element_edge] && this.edges[scroll_edge][element_edge] !== true){
                            return this.edges[scroll_edge][element_edge];
                        }
                    }
                    else if(scroll_edge && !element_edge){
                        if(this.edges[scroll_edge]){
                            return this.edges[scroll_edge];
                        }
                        return;
                    }
                    return this.default_edge;
                };

                this.checkOffset = function(scroll_edge, elem_edge, edge){
                    var offset;
                    if(!edge){
                        edge = this.default_edge;
                    }

                    var scroll_bottom = (scroll_edge == 'bottom');
                    var elem_top = (elem_edge == 'top');
                    var elem_bottom = (elem_edge == 'bottom');

                    var scrollOffset = this.getScrollOffset();
                    if(scroll_bottom){
                        scrollOffset += this.getTargetHeight();
                    }

                    var checkOffset;
                    if(edge.absolute){
                        if(edge.percent){
                            checkOffset = edge.shift / 100.0 * this.getTargetScrollHeight();
                        }
                        else{
                            checkOffset = edge.shift;
                        }
                        if(scroll_bottom){
                            checkOffset = this.getTargetContentHeight() - checkOffset;
                            if(this.hasTarget){
                                checkOffset += this.getTargetHeight();
                            }
                        }
                    }
                    else{
                        if(elem_top){
                            checkOffset = this.getElementTop();
                        }
                        else if(elem_bottom){
                            checkOffset = this.getElementBottom();
                        }
                        checkOffset += edge.shift;
                    }

                    offset = (scrollOffset - checkOffset);
                    if(scroll_bottom){
                        offset *= -1.0;
                    }
                    return offset;
                };

                this.scrollEdgeHit = function(){
                    var offset, edgeHit, absEdges, absEdgeHits;
                    var edge, scroll_edge, element_edge;
                    absEdges = 0;
                    absEdgeHits = {};
                    for(scroll_edge in this.edges){
                        for(element_edge in this.edges[scroll_edge]){
                            edge = this.getEdge(scroll_edge, element_edge);
                            var edge_offset = this.checkOffset(scroll_edge, element_edge, edge);

                            if(edge.absolute){
                                if(angular.isUndefined(absEdgeHits)){
                                    absEdgeHits = {};
                                }
                                if(angular.isUndefined(absEdgeHits[scroll_edge])){
                                    absEdgeHits[scroll_edge] = {};
                                }
                                absEdgeHits[scroll_edge][element_edge] = edge_offset;
                                absEdges++;
                            }
                            else if(angular.isUndefined(offset) || edge_offset > offset){
                                offset = edge_offset;
                                edgeHit = {scroll: scroll_edge, element: element_edge};
                            }
                        }
                    }
                    // special handling for absolute edges when no relative edges hit
                    if(absEdges && !edgeHit){
                        // in case there is more than one absolute edge, they all should pass to count a hit (allows for creating ranges where the scrollpoint is active)
                        var allPass = true;
                        offset = undefined;
                        for(scroll_edge in absEdgeHits){
                            for(element_edge in absEdgeHits[scroll_edge]){
                                if(absEdges > 1 && absEdgeHits[scroll_edge][element_edge] < 0){
                                    allPass = false;
                                }
                                else if(angular.isUndefined(offset) || absEdgeHits[scroll_edge][element_edge] > offset){
                                    offset = absEdgeHits[scroll_edge][element_edge];
                                    edgeHit = {scroll: scroll_edge, element: element_edge};
                                }
                            }
                        }
                        if(!allPass){
                            edgeHit = undefined;
                            offset = undefined;
                        }
                    }
                    this.hitEdge = ((offset >= 0) ? edgeHit : undefined);
                    return offset;
                };

                this.getScrollOffset = function(){
                    return this.hasTarget ? this.$target[0].scrollTop : getWindowScrollTop();
                };
                this.getTargetHeight = function(){
                    return this.hasTarget ? this.$target[0].offsetHeight : getWindowHeight();
                };
                this.getTargetContentHeight = function(){
                    return ( this.hasTarget ? (this.$target[0].scrollHeight - this.$target[0].clientHeight) : getWindowHeight(true) );
                };
                this.getTargetScrollHeight = function(){
                    return ( this.hasTarget ? (this.$target[0].scrollHeight - this.$target[0].clientHeight) : getWindowScrollHeight() );
                };

                this.getElementTop = function(current){
                    if(!current && angular.isDefined(this.posCache.top)){
                        return this.posCache.top;
                    }
                    var bounds = this.$element[0].getBoundingClientRect();
                    var top = bounds.top + this.getScrollOffset();

                    if(this.hasTarget){
                        var targetBounds = this.$target[0].getBoundingClientRect();
                        top -= targetBounds.top;
                    }

                    return top;
                };
                this.getElementBottom = function(current){
                    return this.getElementTop(current) + this.$element[0].offsetHeight;
                };

                this.cachePosition = function(){
                    this.posCache.top = this.getElementTop(true);
                };

                this.onScroll = function() {
                    if(!self.ready || !self.enabled){ return; }

                    var edgeHit = self.scrollEdgeHit();
                    
                    // edgeHit >= 0 - scrollpoint is scrolled out of active view
                    // edgeHit < 0 - scrollpoint is in active view

                    // hit is toggled at the moment the scrollpoint is crossed

                    var fireActions = false;

                    if(edgeHit >= 0){
                        // SCROLLPOINT is OUT by edgeHit pixels
                        if(!self.hit){
                            // add the scrollpoint class
                            if(!self.$element.hasClass(self.scrollpointClass)){
                                self.$element.addClass(self.scrollpointClass);
                            }
                            fireActions = true;
                            self.hit = true;
                        }
                    }
                    else{
                        // SCROLLPOINT is IN by edgeHit pixels
                        if(self.hit || angular.isUndefined(self.hit)){
                            // remove the scrollpoint class
                            if(self.$element.hasClass(self.scrollpointClass)){
                                self.$element.removeClass(self.scrollpointClass);
                            }
                            fireActions = true;
                            self.hit = false;
                        }
                        self.cachePosition();
                    }

                    if(fireActions){
                        // fire the actions
                        if(self.actions){
                            for(var i=0; i < self.actions.length; i++){
                                self.actions[i](edgeHit, self.$element, (self.hitEdge ? self.hitEdge.scroll : undefined), (self.hitEdge ? self.hitEdge.element : undefined));
                            }
                        }
                    }
                };

                this.reset = function(){
                    $timeout(function(){
                        self.$element.removeClass(self.scrollpointClass);
                        self.hit = undefined;
                        self.hitEdge = undefined;
                        self.cachePosition();
                        self.onScroll();
                    });
                };
            },
            link: function (scope, elm, attrs, Ctrl) {
                var uiScrollpoint = Ctrl[0];
                var uiScrollpointTarget = Ctrl[1];
                var absoluteParent = false;

                uiScrollpoint.setElement(elm);
                uiScrollpoint.setTarget( uiScrollpointTarget ? uiScrollpointTarget.$element : null);

                // base ui-scrollpoint (leave blank or set to: absolute, +, -, or %)
                attrs.$observe('uiScrollpoint', function(scrollpoint){
                    uiScrollpoint.setScrollpoint(scrollpoint);
                    uiScrollpoint.reset();
                });

                // ui-scrollpoint-enabled allows disabling the scrollpoint
                attrs.$observe('uiScrollpointEnabled', function(scrollpointEnabled){
                    scrollpointEnabled = scope.$eval(scrollpointEnabled);
                    if(scrollpointEnabled != uiScrollpoint.enabled){
                        uiScrollpoint.reset();
                    }
                    uiScrollpoint.enabled = scrollpointEnabled;
                });

                // ui-scrollpoint-absolute bypasses ui-scrollpoint-target
                attrs.$observe('uiScrollpointAbsolute', function(scrollpointAbsolute){
                    scrollpointAbsolute = scope.$eval(scrollpointAbsolute);
                    if(scrollpointAbsolute != absoluteParent){
                        if(uiScrollpoint.$target){
                            uiScrollpoint.$target.off('scroll', uiScrollpoint.onScroll);
                        }
                        uiScrollpoint.setTarget( (!scrollpointAbsolute && uiScrollpointTarget) ? uiScrollpointTarget.$element : null);
                        resetTarget();
                        uiScrollpoint.reset();
                    }
                    absoluteParent = scrollpointAbsolute;
                });

                // ui-scrollpoint-action function name to use as scrollpoint callback
                attrs.$observe('uiScrollpointAction', function(uiScrollpointAction){
                    var action = scope.$eval(uiScrollpointAction);
                    if(action && angular.isFunction(action)){
                        uiScrollpoint.addAction(action);
                    }
                });

                // ui-scrollpoint-class class to add instead of ui-scrollpoint
                attrs.$observe('uiScrollpointClass', function(scrollpointClass){
                    elm.removeClass(uiScrollpoint.scrollpointClass);
                    uiScrollpoint.setClass(scrollpointClass);
                    uiScrollpoint.reset();
                });

                // ui-scrollpoint-edge allows configuring which element and scroll edges match
                attrs.$observe('uiScrollpointEdge', function(scrollpointEdge){
                    if(scrollpointEdge){
                        // allowed un-$eval'ed values
                        var allowedKeywords = ['top', 'bottom', 'view'];
                        if(allowedKeywords.indexOf(scrollpointEdge) == -1){
                            // $eval any other values
                            scrollpointEdge = scope.$eval(scrollpointEdge);
                        }

                        // assign it in controller
                        uiScrollpoint.setEdges(scrollpointEdge);
                        uiScrollpoint.reset();
                    }
                });
    
                function resetTarget() {
                    uiScrollpoint.$target.on('scroll', uiScrollpoint.onScroll);
                    scope.$on('$destroy', function () {
                        uiScrollpoint.$target.off('scroll', uiScrollpoint.onScroll);
                    });
                }
                resetTarget();
                elm.ready(function(){ uiScrollpoint.ready=true; uiScrollpoint.onScroll(); });
                scope.$on('scrollpointShouldReset', uiScrollpoint.reset);
            }
        };
    }]).directive('uiScrollpointTarget', [function () {
        return {
            controller: ['$element', function ($element) {
                this.$element = $element;
            }]
        };
    }]);
