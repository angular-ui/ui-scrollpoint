/*!
 * angular-ui-scrollpoint
 * https://github.com/angular-ui/ui-scrollpoint
 * Version: 1.0.0 - 2015-07-03T02:58:59.685Z
 * License: MIT
 */


(function () { 
'use strict';
/**
 * Adds a 'ui-scrollpoint' class to the element when the page scrolls past it's position.
 * @param [offset] {int} optional Y-offset to override the detected offset.
 *   Takes 300 (absolute) or -300 or +300 (relative to detected)
 */
angular.module('ui.scrollpoint', []).directive('uiScrollpoint', ['$window', function($window) {

        function getWindowScrollTop() {
            if (angular.isDefined($window.pageYOffset)) {
                return $window.pageYOffset;
            } else {
                var iebody = (document.compatMode && document.compatMode !== 'BackCompat') ? document.documentElement : document.body;
                return iebody.scrollTop;
            }
        }
        return {
            require: '^?uiScrollpointTarget',
            link: function(scope, elm, attrs, uiScrollpointTarget) {
                var absolute = true,
                        shift = 0,
                        fixLimit,
                        $target = uiScrollpointTarget && uiScrollpointTarget.$element || angular.element($window);

                if (!attrs.uiScrollpoint) {
                    absolute = false;
                } else if (typeof (attrs.uiScrollpoint) === 'string') {
                    // charAt is generally faster than indexOf: http://jsperf.com/indexof-vs-charat
                    if (attrs.uiScrollpoint.charAt(0) === '-') {
                        absolute = false;
                        shift = -parseFloat(attrs.uiScrollpoint.substr(1));
                    } else if (attrs.uiScrollpoint.charAt(0) === '+') {
                        absolute = false;
                        shift = parseFloat(attrs.uiScrollpoint.substr(1));
                    }
                }

                fixLimit = absolute ? attrs.uiScrollpoint : elm[0].offsetTop + shift;

                function onScroll() {

                    var limit = absolute ? attrs.uiScrollpoint : elm[0].offsetTop + shift;

                    // if pageYOffset is defined use it, otherwise use other crap for IE
                    var offset = uiScrollpointTarget ? $target[0].scrollTop : getWindowScrollTop();
                    if (!elm.hasClass('ui-scrollpoint') && offset > limit) {
                        elm.addClass('ui-scrollpoint');
                        fixLimit = limit;
                    } else if (elm.hasClass('ui-scrollpoint') && offset < fixLimit) {
                        elm.removeClass('ui-scrollpoint');
                    }
                }

                $target.on('scroll', onScroll);
                onScroll(); // sets the initial state

                // Unbind scroll event handler when directive is removed
                scope.$on('$destroy', function() {
                    $target.off('scroll', onScroll);
                });
            }
        };
    }]).directive('uiScrollpointTarget', [function() {
        return {
            controller: ['$element', function($element) {
                    this.$element = $element;
                }]
        };
    }]);

}());