evaluator = angular.module('evaluator', []);

evaluator.filter('unsafe', function($sce) { return $sce.trustAsHtml; });

evaluator.directive('query', function(queryService,termsService) {
	return {		
		template: '<input ng-model="term.term" ng-change="changeTerm();" placeholder="enter term"/>',
		link: function(scope,elem,attrs,ctrl) {

  				scope.changeTerm = function () {
  					if (scope.term.term == "" || typeof scope.term.term == 'undefined') {
  						return;
  					}
  					var newTerm = scope.term.term;
  					scope.term = new termsService.Term(scope.term.term);  				
  				}
  			
			}		
		}
});

evaluator.directive('judgements', function(judgementService) {
	return {
		transclude: true,
		template: '<div ng-click="judge($event);" class="button red" data-choice="{{ choices[0] }}"><i class="icon arrow left"/>{{ choices[0] }}</div>\
		<div ng-click="skip();" class="button gray" data-choice="SKIP"><i class="icon arrow up"/>SKIP</div>\
		<div ng-click="judge($event);" class="button green" data-choice="{{ choices[1] }}">{{ choices[1] }}<i class="icon arrow right"/></div> ',
		link: function(scope,elem,attrs,$timeout) {
			scope.judge = function($event) {
				console.log("CLICK");
				console.log($event.currentTarget.attributes);
			    angular.element($event.currentTarget).addClass("active");
			    setTimeout(function() { 
				    angular.element($event.currentTarget).removeClass("active");
				}, 200);
				scope.term.judgement = $event.currentTarget.attributes["data-choice"].value;
				var s = judgementService.save(scope.term);
				s.then(function(payload) { console.log(payload) });
				scope.nextTerm();
			}	
			scope.skip = function() {
				console.log("SKIP");	
				scope.nextTerm();
			}


		}		
	}
});

evaluator.directive('results',function(queryService) {
	return {
		restrict: 'E',
		transclude: true,	
		scope: true,
		template: '<div class="results">NUM FOUND: {{ results.response.numFound }} \
					<div ng-repeat="doc in results.response.docs" class="result"><span class="offerId">{{ doc.skuid }} - {{ doc.final_boost }} - {{ doc.score }}</span><span class="offerTitle" ng-bind-html="doc.productname[0] | unsafe"></span><action data-id="{{ doc.skuid }}" data-title="{{ doc.productname[0] }}"></action></div>\
					</div>',
		link: function(scope, elem, attrs) {
			
			scope.toggle = function(obj,$event) {
				$event.target.previousElementSibling.show();
			}
			
			scope.$watch('term.term', function() {				
					scope.setResults();					
			});
				
			scope.setResults = function() {
					console.log("SETTING SET RESULTS FOR " + attrs.version);	
					var version = attrs.version;
					if (typeof scope.term == "undefined") {
						return
					}
					var query = queryService.getResults(scope.term.term, version);
					query.then(
							function(payload) {
								console.log("DATA RETRIEVED FOR VERSION " + version);
								scope.results = payload.data;									
							});
			}
			
			//scope.setResults();

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

evaluator.directive('terms', function(termsService, judgementService) {
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

evaluator.directive('finished', function() {
	return {
		template: '<h2>{{ choice }}</h2><div ng-repeat="term in judgements | filter: { judgement:choice } track by $index "><b ng-class="term.judgement" ng-bind-html="term.term | unsafe"></b> <i ng-repeat="flag in term.flags track by $index">{{ flag.id }} <span ng-bind-html="flag.title | unsafe"></span><span ng-show="!$last">, </span></i></div>',
		scope: true,
		link: function(scope,elem,attrs) {
			scope.choice = attrs.choice;
		}

	}
});

evaluator.directive('report', function(judgementService,$filter) {
	return {
		template: '<table class="selectable ui celled table collapsing"><thead><tr><th>Term</th><th>First</th><th>Second</th><th>Flags</th></tr></thead>\
					<tbody>\
					<tr ng-click="query($event)" term="{{ judgement.term }}" ng-repeat="judgement in judgements track by $index">\
					<td  class="collapsing" ng-bind-html="judgement.term | unsafe"></td><td class="collapsing">{{ judgement.first_votes }}</td><td class="collapsing">{{ judgement.second_votes }}</td><td class="collapsing"><span><p ng-repeat="flag in judgement.flags track by $index" ng-bind-html="flag.title | unsafe">({{ flag.id }})</p></span></td>\
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
		    var promise = judgementService.getReport(version);
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
	var scope = angular.element("body").scope();
    if(e.keyCode === 37) {
      angular.element('[data-choice="'+scope.choices[0]+'"]').trigger('click');
    }   
    if(e.keyCode === 38) {
      angular.element('[data-choice="SKIP"]').trigger('click');
    } 
    if(e.keyCode === 39) {
      angular.element('[data-choice="'+scope.choices[1]+'"]').trigger('click');
    } 
    if(e.keyCode === 40) {
      angular.element('[data-choice="BACK"]').trigger('click');
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

evaluator.service('judgementService', function($http) {
   return {
        save: function(judgement) {    
        	
        	console.log("SAVING");
			problems = judgement.flags
			judgement.flags = []
			for (i in problems) {
				judgement.flags.push(problems[i])
			 }
                 
             return $http.post('/judgements/save',{header : {'Content-Type' : 'application/json; charset=UTF-8'},judgements:[judgement]})
                       .then(function(result) {  
                       		console.log(result);                          
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
                 
             return $http.get('/query/' + version + '/' + escape(term),{header : {'Content-Type' : 'application/json; charset=UTF-8'}})
                       .then(function(result) {                            
                            return result;
                        });
        }
   }
});

angular.element(document).ready(function () {
        angular.element("body").focus();
});
    
