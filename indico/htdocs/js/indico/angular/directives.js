/* This file is part of Indico.
 * Copyright (C) 2002 - 2014 European Organization for Nuclear Research (CERN).
 *
 * Indico is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * Indico is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Indico; if not, see <http://www.gnu.org/licenses/>.
 */

var ndDirectives = angular.module("ndDirectives", []);

ndDirectives.directive("ndDialog", function($http, $compile, $timeout) {
    return {
        restrict: 'E',
        scope: {
            show: '=',
            heading: '@',
            okButton: '@',
            okCallback: '&',
            okOnly: '=',
            cancelButton: '@',
            cancelCallback: '&',
            validate: "=",
            api: '=',
            data: '=',
            config: "="
        },

        controller: function($scope) {
            $scope.actions = {
                init: function() {},
                cleanup: function() {},
                close: function() {
                    $scope.$apply($scope.validationStarted = false);
                    $scope.actions.cleanup();
                    $scope.show = false;
                    $scope.$apply($scope.show);
                },
                cancel: function() {
                    $scope.cancelCallback({dialogScope: $scope});
                    $scope.actions.close();
                },
                ok: function() {
                    $scope.$apply($scope.validationStarted = true);
                    var resultOkCallback = $scope.okCallback({dialogScope: $scope});
                    if(($scope.validate === true && resultOkCallback === true) || $scope.validate !== true) {
                        $scope.actions.close();
                    }
                }
            };
        },

        link: function(scope, element) {
            var dialog;

            var initDialog = function() {
                dialog = new ExclusivePopupWithButtons(
                    scope.heading,
                    scope.actions.cancel,
                    false,
                    false,
                    true
                );

                dialog._onClose = function() {};

                dialog._getButtons = function() {
                    var buttons = [];
                    var ok = scope.okButton || $T('Ok');
                    var cancel = scope.cancelButton || $T('Cancel');

                    buttons.push([ok, function() {
                        scope.actions.ok();
                    }]);

                    if (!scope.okOnly) {
                        buttons.push([cancel, function() {
                            scope.actions.cancel();
                        }]);
                    }

                    return buttons;
                };

                dialog.draw = function() {
                    return this.ExclusivePopupWithButtons.prototype.draw.call(this, element);
                };

                dialog.postDraw = function() {
                    this.canvas.dialog('option', 'draggable', false);
                    this.canvas.dialog('option', 'position', 'center');
                };
            };

            var openDialog = function() {
                if (dialog) {
                    showDialog();
                } else {
                    $http.get(
                        scope.templateUrl, {}
                    ).success(function(response, status, header, config) {
                        element = angular.element(response);
                        $compile(element)(scope);
                        $timeout(function(){
                            initDialog();
                            showDialog();
                        }, 0);
                    }). error(function(data, status, header, config) {
                        scope.show = false;
                        var msg = $T('The content of this dialog is currently unavailable.');
                        new AlertPopup(scope.heading, msg).open();
                    });
                }
            };

            var showDialog = function() {
                scope.actions.init();
                dialog.open();
            };

            scope.setSelectedTab = function(tab_id) {
                scope.tabSelected = tab_id;
            };

            scope.isTabSelected = function(tab_id) {
                return scope.tabSelected === tab_id;
            };

            scope.$watch("show", function(val) {
                if (scope.show === true) {
                    openDialog();
                } else if (dialog) {
                    dialog.close();
                }
            });
        }
    };
});

ndDirectives.directive("contenteditable", function() {
    return {
        require: 'ngModel',
        link: function(scope, elem, attrs, ctrl) {
            var updateHtml = function() {
                if(ctrl.$viewValue === '') {
                    elem.html(attrs.placeholder);
                    elem.addClass('empty');
                } else {
                    elem.html(ctrl.$viewValue);
                }
            };

            // view -> model
            elem.on('blur', function(e, param) {
                updateHtml();
            });

            // model -> view
            ctrl.$render = function() {
                updateHtml();
            };

            // remove placeholder
            elem.on('focus', function() {
                elem.removeClass('empty');
                if (ctrl.$viewValue === '') {
                    elem.html('');
                }
            });

            elem.on('keydown keypress', function(e) {
                if(e.keyCode === K['ESCAPE']) {
                    elem.blur();
                } else if(e.keyCode === K['ENTER']) {
                    scope.$apply(function() {
                        ctrl.$setViewValue(elem.html());
                    });
                    elem.blur();
                }
            });
        }
    };
});

ndDirectives.directive('ndDatepicker', function($compile) {
    return {
        restrict: 'E',
        replace: 'true',
        template: '<ng-form name="dateForm"></ng-form>',
        scope: {
            dateFormat: '@',
            hiddenInputs: '@',
            required: '@',
            showTime: '=',
            validation: '=',
            value: '='
        },

        link: function(scope, element) {
            var hiddenInputs =
                scope.$eval(scope.hiddenInputs) ||
                ['day', 'month', 'year', 'hour', 'min'];

            var mapMomentFormat = function(format) {
                format = format.replace('%Y', 'YYYY');
                format = format.replace('%m', 'MM');
                format = format.replace('%d', 'DD');
                format = format.replace('%H', 'HH');
                format = format.replace('%M', 'mm');
                return format;
            };

            var updateModel = function() {
                _.each(element.find('input'), function(e) {
                    $(e).trigger('input');
                });
            };

            var getAttributes = function() {
                var attributes = {};

                attributes['ng-class'] = "{hasError: validation && dateForm.$invalid}";
                if (scope.required) {
                    attributes.required = "required";
                }

                return attributes;
            };

            var getDatetime = function() {
                if (scope.value) {
                    return moment('{0} {1}'.format(scope.value.date, scope.value.time), 'YYYY-MM-DD HH:mm:ss');
                } else {
                    return null;
                }
            };

            var createDatePicker = function() {
                return IndicoUI.Widgets.Generic.dateField(
                    scope.showTime,
                    getAttributes(),
                    hiddenInputs,
                    null,
                    scope.dateFormat,
                    updateModel
                );
            };

            var getInputHtml = function(inputId) {
                var required = '';
                var value = null;

                if (inputId.match('Year') !== null) {
                    required = 'ng-required="{{required}}"';
                }

                if (scope.value) {
                    if (inputId.match('Year') !== null) {
                        value = getDatetime().year();
                    } else if (inputId.match('Month') !== null) {
                        value = getDatetime().month() + 1;
                    } else if (inputId.match('Day') !== null) {
                        value = getDatetime().date();
                    } else if (inputId.match('Hour') !== null) {
                        value = getDatetime().hour();
                    } else if (inputId.match('Min') !== null) {
                        value = getDatetime().minute();
                    }
                }

                return '<input type="text" name="{0}" id="{0}" ng-model="{0}" ng-init="{0}={1}" {2} style="display: none"/>'.format(inputId, value, required);
            };

            var init = function() {
                var datepicker = createDatePicker();

                element.html(datepicker.dom);
                _.each(hiddenInputs, function(inputId) {
                    element.append(getInputHtml(inputId));
                });

                if (scope.value) {
                    datepicker.set(getDatetime().format(mapMomentFormat(scope.dateFormat)));
                }

                $compile(element)(scope);
            };

            scope.$watch('dateFormat', function(newVal, oldVal) {
                init();
            });

            init();
        }
    };
});

ndDirectives.directive('ndConfirmationPopup', function() {
    return {
        restrict: 'E',
        scope: {
            heading: '@',
            content: '@',
            callback: '=',
            show: '='
        },

        link: function(scope) {
            var open = function() {
                var popup = new ConfirmPopup(scope.heading, scope.content, scope.callback);
                popup.open();
            };

            scope.$watch('show', function() {
                if (scope.show === true) {
                    scope.show = false;
                    open();
                }
            });
        }
    };
});

ndDirectives.directive('ndValidFile', function() {
    return {
        require: 'ngModel',
        link: function (scope, el, attrs, ngModel) {
            ngModel.$render = function () {
                ngModel.$setViewValue(el.val());
            };

            el.bind('change', function() {
                scope.$apply(function() {
                    ngModel.$render();
                });
            });
        }
    };
});

ndDirectives.directive('ndRadioExtend', function($rootScope) {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function(scope, element) {
            element.bind('click', function() {
                $rootScope.$$phase || $rootScope.$apply();
            });
        }
    };
});

ndDirectives.directive('ndBlacklist', function() {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, ngModel) {
            var blacklist = attrs.ndBlacklist.split(',');

            // DOM -> Model validation
            ngModel.$parsers.unshift(function(value) {
                var valid = blacklist.indexOf(value) === -1;
                ngModel.$setValidity('blacklist', valid);
                return valid ? value : undefined;
            });

            // model -> DOM validation
            ngModel.$formatters.unshift(function(value) {
                ngModel.$setValidity('blacklist', blacklist.indexOf(value) === -1);
                return value;
            });
        }
    };
});

ndDirectives.directive('ndInitFocus', function() {
    var timer;

    return function(scope, element, attrs) {
        if (timer) clearTimeout(timer);

        timer = setTimeout(function() {
            element.focus();
        }, 0);
    };
});
