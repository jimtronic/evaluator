evaluator = angular.module('evaluator', []);

evaluator.filter('unsafe', function($sce) { return $sce.trustAsHtml; });

evaluator.directive('results', function() {
	return {
		transclude: true,
		template: '<query/><first/>'
	}
});	

evaluator.directive('query', function(queryService) {
	return {
		template: '<input ng-model="term.term" placeholder="enter term"/>',
		link: function(scope,elem,attrs) {
				scope.getResults = function () {
					if (typeof scope.term == "undefined" || scope.term == "") {
						scope.firstResults = null;
						return;
					}
				
					var first = queryService.getResults(scope.term.term, version);
					first.then(
  						function(payload) {
    						scope.firstResults = payload.data;    					
  						});  					
  				};
  			
				scope.$watch('term.term', function() {				
					scope.getResults();
				});
				
				scope.getResults();
			}		
		}
});

evaluator.directive('judgements', function() {
	return {
		transclude: true,
		template: '<div id="BAD" ng-click="judge($event);" class="button red" data="BAD"><i class="icon arrow left"/>BAD</div> <div ng-click="judge($event);" id="GOOD" class="button green" data="GOOD">GOOD<i class="icon arrow right"/></div> ',
		link: function(scope,elem,attrs,$timeout) {
			scope.judge = function($event) {
			    angular.element($event.currentTarget).addClass("active");
			    setTimeout(function() { 
				    angular.element($event.currentTarget).removeClass("active");
				}, 200);
				scope.term.judgement = $event.currentTarget.attributes.data.value;
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
			scope.toggle = function(obj,$event) {
				$event.target.previousElementSibling.show();
			}
		}		
	}
});

evaluator.directive('action', function() {
	return {
		template: '<i class="flag icon" ng-class="{ \'selected\': selected }">',
		link: function(scope,elem,attrs) {
		    scope.selected = angular.element("body").scope().term.flags.map(function(x) { return x.id }).indexOf(attrs.id) != -1;
			scope.toggleFlags = function() {
				scope.selected = !scope.selected;
				if(scope.selected) {
					flag = {}
					flag.id = attrs['id'];
					flag.title = attrs['title'];
					scope.term.flags.push(flag);
				} else {
					for (f in scope.term.flags) {
						if( scope.term.flags[f].id == attrs['id'] ) {
							delete scope.term.flags[f];
						}
					}
				}
				
				scope.$digest();
			}
			elem.bind('click', scope.toggleFlags);			
		}
	}
});

evaluator.directive('terms', function(termsService) {
	return {
		template: '<div class="term" ng-repeat="t in terms track by $index" ng-bind-html="t | unsafe"></div>',
		link: function(scope,elem,attrs) {
			var promise = termsService.getTerms();
			scope.terms = []
			scope.judgements = []
			promise.then(
  					function(payload) {
    					scope.terms = payload.data.split('\n');   
    					scope.term = new termsService.Term(scope.terms.shift());
  					});
  					
			scope.nextTerm = function() {
				scope.judgements.unshift(scope.term);
				if (scope.terms.length > 0) {
					scope.term = scope.term = new termsService.Term(scope.terms.shift());
				} else {
					scope.term = {};
				}
			}
			
		}
	}
});

evaluator.directive('finished', function(reportService) {
	return {
		template: '<button ng-click="submitReport();">submit results</button><div ng-repeat="term in judgements track by $index"><b ng-class="term.judgement" ng-bind-html="term.term | unsafe"></b> <i ng-repeat="flag in term.flags track by $index">{{ flag.id }} <span ng-bind-html="flag.title | unsafe"></span><span ng-show="!$last">, </span></i></div>',
		link: function(scope,elem,attrs) {
			scope.submitReport = function() {				
				var promise = reportService.submitReport(scope.judgements);
				promise.then(
  					function(payload) {
    					angular.element("#all").hide();
    					angular.element("thanks").show();					
  					}
  				);				
			}
		}

	}
});

evaluator.directive('report', function(reportService,$filter) {
	return {
		template: '<table class="selectable ui celled table collapsing"><thead><tr><th>Term</th><th>Bad</th><th>Good</th><th>Flags</th></tr></thead>\
					<tbody>\
					<tr ng-click="query($event)" term="{{ judgement.term }}" ng-repeat="judgement in judgements track by $index">\
					<td  class="collapsing" ng-bind-html="judgement.term | unsafe"></td><td class="collapsing">{{ judgement.bad_votes }}</td><td class="collapsing">{{ judgement.good_votes }}</td><td class="collapsing"><span><p ng-repeat="flag in judgement.flags track by $index" ng-bind-html="flag.title | unsafe">({{ flag.id }})</p></span></td>\
					</tr>\
					</tbody>\
					</table>',
		link: function(scope,elem,attrs) {
			scope.terms = []
		    scope.query = function($event) {
		    	var term = $event.currentTarget.attributes.term.value;
		    	var found = $filter('filter')(scope.judgements, {term: term}, true);
     			if (found.length) {     				   			
					scope.term = found[0];
         		}		    	
		    };
		    var promise = reportService.getReport(version);
		    promise.then(
		    	function(payload) {
		    		scope.judgements = payload.data;
		    	}
		    );
		}	
	}
});

evaluator.directive('versions', function(versionService,$filter) {
	return {
		template: '<table class="selectable ui celled table collapsing"><thead><tr><th>Name</th><th>Links</th><th>Notes</th><th>Url</th></tr></thead>\
					<tbody>\
					<tr ng-repeat="version in versions track by $index">\
					<td  class="collapsing">{{ version.name }}</td>\
					<td class="collapsing"><a target="_blank" href="/evaluate/{{ version.name }}">evaluate</a><br />\
					<a target="_blank" href="/report/{{ version.name }}">report</a><br />\
					<a href="#" ng-click="deleteVersion($event)" version="{{ version.name }}">delete</a>\
					</td>\
					<td class="collapsing">{{ version.notes }}</td><td class="collapsing">{{ version.url }}</td>\
					</tr>\
					<tfoot><th colspan="100%">\
					<div ng-click="addVersion()" class="ui right floated small primary labeled icon button"><i class="Add Square icon"></i> Add Version</div>\
					</th>\
        			</tfoot>\
					</tbody>\
					</table>',
		link: function(scope,elem,attrs) {
		    var promise = versionService.getVersions();
		    promise.then(
		    	function(payload) {
		    		scope.versions = payload.data;
		    	}
		    );			
		    scope.addVersion = function() {
		    	$('#versionForm').modal('show');
		    }
		    scope.deleteVersion = function($event) {
		    	var name = $event.currentTarget.attributes.version.value;
		    	versionService.deleteVersion(name);
		    	window.location = "";
		    }
		}	
	}
});

evaluator.directive('versionform', function(versionService) {
	return {
		template: '<div id="versionForm" class="ui modal">\
	  			<i class="close icon"></i>\
				  <div class="header">\
					New Version\
				  </div>\
				  <div class="ui content">\
				<div class="ui form">\
				  <div class="field">\
					<label>Name</label>\
					<input type="text" ng-model="newVersion.name">\
				  </div>\
					<div class="field">\
					<label>Notes</label>\
					<input type="text" ng-model="newVersion.notes">    \
				  </div>\
				  <div class="field">\
					<label>Url</label>\
					<input type="text" ng-model="newVersion.url">    \
				  </div>\
				</div>\
				</div>\
				  <div class="actions">\
					<div class="ui button black deny">Cancel</div>\
					<div ng-click="addNewVersion();" class="ui positive right labeled icon button">\
					  Save\
					  <i class="checkmark icon"></i>\
					</div>\
				  </div>\
				</div>',
		link: function(scope,elem,attrs) {
			scope.addNewVersion = function() {
				versionService.saveVersion(scope.newVersion);
				window.location = "";
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
        },
        Term: function(term) {
        	this.term = term;
        	this.flags = [];
        	this.judgement = '';
        	this.version = version;
        	return this;
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
                 
             return $http.post('/judgements/save',{header : {'Content-Type' : 'application/json; charset=UTF-8'},judgements:report})
                       .then(function(result) {                            
                            return result;
                        });
        },
        getReport: function(version) {
        	return $http.get('/judgements/' + version, {header : {'Content-Type' : 'application/json; charset=UTF-8'}})
        				.then(function(result) {
        					return result;
        				});
        }        
   }
});

evaluator.service('versionService', function($http) {
	return {
        getVersions: function() {
        	return $http.get('/versions/all', {header : {'Content-Type' : 'application/json; charset=UTF-8'}})
        				.then(function(result) {
        					return result;
        				});
        },
        saveVersion: function(version) {
        	return $http.post('/version/save', {header : {'Content-Type' : 'application/json; charset=UTF-8'}, version: version })
        		.then(function(result) {
        			return result;
        		});
        },
        deleteVersion: function(version) {
        	return $http.post('/version/delete', {header : {'Content-Type' : 'application/json; charset=UTF-8'}, version: version })
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

angular.element(document).ready(function () {
        angular.element("body").focus();
});
    
