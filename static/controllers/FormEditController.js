myApp.controller('FormEditController', function($scope, $request, $location, $route, $alert) {
	$scope.new = $route.current.$$route.data.new;
	$scope.form = {};
	$scope.form.name = "";
	$scope.fields = [];

	$scope.fieldTypes = {
		text: "Text",
		//number: "Number",
		date: "Date"
		//time: "Time"
	}

	$scope.index_count = 0

	$scope.fieldSelected = null;

	$scope.addField = function(type) {
		$scope.fieldSelected = $scope.fields[$scope.fields.length] = {
			type: type,
			name: "",
			helper: "",
			required: false
		}	
	}
	$scope.displayField = function(index) {
		if(index < $scope.fields.length) $scope.fieldSelected = $scope.fields[index]
	}
	$scope.deleteField = function(index){
		if ($scope.fields[index] == $scope.fieldSelected) $scope.fieldSelected = null;
		$scope.fields.splice(index, 1);
	}
	$scope.submitNewForm = function(){
		$request.post('/form/new', {fields: $scope.fields, form: $scope.form})
		.then(function(res){
			$location.path( "/manager" );
			$alert.success('Form created');
			$scope.$apply();
		});
		///handle error
	}
	$scope.updateForm = function(){
		alert('not implemented');
	}
});