angular.element(document).ready(function () {
        angular.element("body").focus();
});
    
evaluator = angular.module('cw', []);

evaluator.filter('unsafe', function($sce) { return $sce.trustAsHtml; });

evaluator.directive('search', function(queryService) {	
	return {		
		transclude: true,
		template:'<terms></terms>',
		link: function(scope, elem, attrs) {
			scope.getResults = function (scope) {
				if (typeof scope.term == "undefined" || scope.term == "") {
					scope.firstResults = null;
					scope.$digest();
					return;
				}
				
				console.log(scope.terms[0]);
				var first = queryService.getResults(scope.term,'current');
				first.then(
  					function(payload) {
  						console.log("FIRST QUERY DONE");
    					scope.firstResults = payload.data;    					
  					});
  				var second = queryService.getResults(scope.term,'v1');
  				second.then(
  					function(payload) {
  						console.log("SECOND QUERY DONE");
    					scope.secondResults = payload.data;    					
  					});
  			};
  			
			scope.$watch('term', function() {				
				scope.getResults(scope);
			});
			
			scope.getResults(scope);
		}
	}
});

evaluator.directive('results', function() {
	return {
		template: '<judgements/><query/><first/>',
		link: function(scope,elem,attrs) {
			console.log("RESULTS LOADED");
		}
	}
});	

evaluator.directive('query', function() {
	return {
		template: '<input ng-model="term" placeholder="enter term"/>',
		link: function(scope,elem,attrs) {
			console.log("QUERY LOADED");
		}		
	}
});

evaluator.directive('judgements', function() {
	return {
		template: '<div id="BAD" ng-click="judge($event);" class="button red" data="BAD"><i class="icon arrow left"/>BAD</div> <div ng-click="judge($event);" id="GOOD" class="button green" data="GOOD">GOOD<i class="icon arrow right"/></div> ',
		link: function(scope,elem,attrs,$timeout) {
			console.log("JUDGEMENTS LOADED");
			scope.judge = function($event) {
			    angular.element($event.currentTarget).addClass("active");
			    setTimeout(function() { 
				    angular.element($event.currentTarget).removeClass("active");
				}, 200);
				scope.terms[0].judgement = $event.currentTarget.attributes.data.value;
				scope.nextTerm();
			}			
		}		
	}
});

evaluator.directive('first',function() {
	return {
		restrict: 'E',
				
		template: '<div class="results">NUM FOUND: {{ firstResults.response.numFound }} {{ firstResults.responseHeader }}\
					<div ng-repeat="doc in firstResults.response.docs" class="result"><span class="offerId">{{ doc.id }}</span><span class="offerTitle" ng-bind-html="doc.offerTitle | unsafe"></span><action data-id="{{ doc.id }}" data-title="{{ doc.offerTitle }}"></action></div>\
					</div>',
		link: function(scope, elem, attrs) {
			console.log("FIRST LOADED");
			scope.toggle = function(obj,$event) {
				console.log("TOGGLE!");
				console.log($event.currentTarget);
				console.log($event.target.previousElementSibling);
				$event.target.previousElementSibling.show();
			}
		}		
	}
});

evaluator.directive('action', function() {
	return {
		template: '<i class="flag icon" ng-class="{ \'selected\': selected }">',
		link: function(scope,elem,attrs) {
			
		    scope.selected = "r_" + attrs.id in scope.terms[0].flags
			
			scope.toggleFlags = function() {
				scope.selected = !scope.selected;
				if(scope.selected) {
					flag = {}
					flag.id = attrs['id'];
					flag.title = attrs['title'];
					scope.terms[0].flags["r_" + attrs.id] = flag;
				} else {
					delete scope.terms[0].flags["r_" + attrs.id]
				}
				
				scope.$digest();
			}
			elem.bind('click', scope.toggleFlags);			
		}
	}
});

evaluator.directive('terms', function(termsService) {
	return {
		template: '<div class="term {{ term.status }}" ng-repeat="term in terms track by $index" ng-bind-html="term.term | unsafe"></div>',
		link: function(scope,elem,attrs) {
			var promise = termsService.getTerms();
			scope.terms = []
			scope.seen = []
			promise.then(
  					function(payload) {
  						console.log("TERMS GOTTEN");
    					terms = payload.data.split('\n');   
    					for (term in terms) {    					
    						scope.terms.push({term:terms[term], version:'V1', user: 'anonymous', status:'unseen', score: 0, flags:{}})
    					}
    					scope.term = scope.terms[0].term;					
  					});
			console.log("TERMS LOADED");
			scope.nextTerm = function() {
				console.log("NEXT");
				scope.terms[0].status = "seen";
				scope.seen.unshift(scope.terms.shift());
				if (scope.terms.length > 0) {
					scope.term = scope.terms[0].term;
				} else {
					scope.term = "";
				}
			}
			
			scope.previousTerm = function() {
				if (scope.seen.length == 0) {
					return;
				}
				console.log("PREVIOUS");
				scope.terms[0].status = "seen";
				scope.terms.unshift(scope.seen.shift());
				scope.term = scope.terms[0].term;
				
			}			
			
		}
	}
});

evaluator.directive('report', function(reportService) {
	return {
		template: '<button ng-click="submitReport();">submit results</button><div ng-repeat="term in seen track by $index"><b ng-class="term.judgement" ng-bind-html="term.term | unsafe"></b> <i ng-repeat="flag in term.flags track by $index">{{ flag.id }} <span ng-bind-html="flag.title | unsafe"></span><span ng-show="!$last">, </span></i></div>',
		link: function(scope,elem,attrs) {
			console.log("REPORT LOADED");
			scope.submitReport = function() {				
				var promise = reportService.submitReport(scope.seen);
				promise.then(
  					function(payload) {
  						console.log("REPORT SAVED");
    					angular.element("#all").hide();
    					angular.element("thanks").show();					
  					}
  				);				
			}
		}

	}
});

evaluator.directive('thanks', function() {
	return {
		template: 'Thanks! You\'re the best!<div><i class="thumbs up icon"></i></div>'
	}
});

var handler = function(e){
    if(e.keyCode === 39) {
      angular.element("#GOOD").trigger('click');
    }   
    if(e.keyCode === 37) {
      angular.element("#BAD").trigger('click');
    } 
};

var $doc = angular.element(document);
$doc.on('keydown', handler);

evaluator.service('termsService', function($http) {
   return {
        getTerms: function() {    
                 
             return $http.get('/terms.txt')
                       .then(function(result) {                            
                            return result;
                        });
        }
   }
});

evaluator.service('reportService', function($http) {
   return {
        submitReport: function(report) {    
        	
        	 for (j in report) {
        	 	problems = report[j].flags
        	 	report[j].flags = []
        	 	for (i in problems) {
        	 		report[j].flags.push(problems[i])
        	 	}
        	 }
                 
             return $http.post('save',{header : {'Content-Type' : 'application/json; charset=UTF-8'},judgements:report})
                       .then(function(result) {                            
                            return result;
                        });
        }
   }
});

evaluator.service('queryService', function($http) {
   return {
        getResults: function(term, version) { 
                 
             return $http.get('/query/' + version + '/' + term,{header : {'Content-Type' : 'application/json; charset=UTF-8'}})
                       .then(function(result) {                            
                            return result;
                        });
        }
   }
});