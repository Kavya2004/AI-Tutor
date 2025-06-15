
function plotPhi() {
		var d = [];
		d.push([-500, 0]);
		d.push([-5.5, 0]);
		for (var i = -5; i <= 5; i+=0.01) {
			d.push([i, normalCDF(i, 0, 1)]);
		}
		d.push([5.5, 1]);
		d.push([500, 1]);
		var plot = $.plot("#placeholder", [{data: d, label: "Phi function", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: -5, max: 5},
				yaxis: {}
			});
		zoomButtons(plot);
}

//same as Phi plot, but with x and y coordinates switched
function plotPhiInv() {
		var d = [];
		d.push([0, -500]);
		d.push([0, -5.5]);
		for (var i = -5; i <= 5; i+=0.01) {
			d.push([normalCDF(i, 0, 1), i]);
		}
		d.push([1, 5.5]);
		d.push([1, 500]);
		var plot = $.plot("#placeholder", [{data: d, label: "Phi inverse", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: -0.5, max: 1.5},
				yaxis: {min: -4, max: 4}
			});
		zoomButtons(plot);
}

function plotNormalCDF(form) {
		var mu = eval(form.m.value);
		var sig = eval(form.s.value);
		if(sig <= 0){
			 alert("The value of sigma should be greater than 0.");
		 	 return;
		}
		var min = -5*sig+mu;
		var max = 5*sig+mu;
		var d = [];
		d.push([min-500*(max-min), 0]);
		d.push([min, 0]);
		for (var i = min; i <= max; i+=((max-min)/1000)) {
			d.push([i, normalCDF(i, mu, sig)]);
		}
		d.push([max, 1]);
		d.push([max+500*(max-min), 1]);
		var plot = $.plot("#placeholder", [{data: d, label: "Normal distr CDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: min, max: max},
				yaxis: {}
			});
		zoomButtons(plot);
}

function plotNormalPDF(form) {
		var mu = eval(form.m.value);
		var sig = eval(form.s.value);
		if(sig <= 0){
			 alert("The value of sigma should be greater than 0.");
		 	 return;
		}
		var min = -5*sig+mu;
		var max = 5*sig+mu;
		var d = [];
		d.push([min-500*(max-min), 0]);
		d.push([min, 0]);
		for (var i = min; i <= max; i+=((max-min)/1000)) {
			d.push([i, normalPDF(i, mu, sig)]);
		}
		d.push([max, 0]);
		d.push([max+500*(max-min), 0]);
		var plot = $.plot("#placeholder", [{data: d, label: "Normal distr PDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: min, max: max},
				yaxis: {}
			});
		zoomButtons(plot);
}

function plotExpCDF(form) {
		var lam = eval(form.l.value);
		if(lam <= 0){
			alert("The value of lambda should be greater than 0.");
			return;
		}
		var max = 10/lam;
    	var d = [];
		d.push([-500*max, 0]);
		d.push([0, 0]);
		for (var i = 0; i <= max; i+=(0.1/lam)) {
			d.push([i, 1-Math.exp(-lam*i)]);
		}
		d.push([max, 1]);
		d.push([500*max, 1]);
		var plot = $.plot("#placeholder", [{data: d, label: "Exponential distr CDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: 0, max: max},
				yaxis: {}
			});
		zoomButtons(plot);
		 
}

function plotExpPDF(form) {
		var lam = eval(form.l.value);
		if(lam <= 0){
			alert("The value of lambda should be greater than 0.");
			return;
		}
		var max = 10/lam;
    	var d = [];
		d.push([-500*max, 0]);
		d.push([0, 0]);
		d.push(null);
		for (var i = 0; i <= max; i+=(0.1/lam)) {
			d.push([i, lam*Math.exp(-lam*i)]);
		}
		d.push([max, 0]);
		d.push([500*max, 0]);		
		var plot = $.plot("#placeholder", [{data: d, label: "Exponential distr PDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: 0, max: max},
				yaxis: {}
			});
		zoomButtons(plot);
}

function plotBinomialCDF(form) {
		var n = eval(form.n.value);
		var p = eval(form.p.value);
		if(n<=0){
			alert("n should be greater than 0.");
			return;
		}
		if(p<0 || p>1){
			alert("Probability should be in the range [0, 1].");
			return;
		}	
		var d = [];
		for (var i = Math.round(-100*n); i < Math.round(100*n); i++) {
			d.push([i, binomialCDF(p, n, i)]);
			d.push([i+1, binomialCDF(p, n, i)]);
			d.push(null);
		}
		var plot = $.plot("#placeholder", [{data: d, label: "Binomial distr CDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: 0, max: n},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function plotBinomialPMF(form) {
		var n = eval(form.n.value);
		var p = eval(form.p.value);
		if(n<=0){
			alert("n should be greater than 0.");
			return;
		}
		if(p<0 || p>1){
			alert("Probability should be in the range [0, 1].");
			return;
		}
		var d1 = [];
		var d2 = [];
		for (var i = Math.round(-100*n); i <= Math.round(100*n); i++) {
			var val = binomialPMF(p, n, i);
			d1.push([i, val]);
			d2.push([i, 0]);
			d2.push([i, val]);
			d2.push(null);
		}
		var plot = $.plot("#placeholder", 
			[{data: d1, label: "Binomial distr PMF", color: "#06A149", points: { show: true, fillColor: "#06A149"}},
			 {data: d2, color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: 0, max: n},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function plotBernoulliCDF(form) {
		var p = eval(form.p.value);
		if(p<0 || p>1){
			alert("Probability should be in the range [0, 1].");
			return;
		}
		var d = [[-500, 0], [0, 0], null, [0, 1-p], [1, 1-p], null, [1, 1], [500, 1]];		
		var plot = $.plot("#placeholder", [{data: d, label: "Bernoulli distr CDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
				xaxis: {min: -1, max: 2},
				yaxis: {min: 0, max: 1.2}
			});
		zoomButtons(plot);
}

function plotBernoulliPMF(form) {
		var p = eval(form.p.value);
		if(p<0 || p>1){
			alert("Probability should be in the range [0, 1].");
			return;
		}		
		var d1 = [[0, 1-p], [1, p]];;
		var d2 = [[0, 0], [0, 1-p], null, [1, 0], [1, p]];
		var plot = $.plot("#placeholder", 
			[{data: d1, label: "Bernoulli distr PMF", color: "#06A149", points: { show: true, fillColor: "#06A149"}},
			 {data: d2, color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
			 	xaxis: {min: -1, max: 2},
				yaxis: {min: 0, max: 1.2}
			});
		zoomButtons(plot);
}

function plotGeometricCDF(form) {
		var p = eval(form.p.value);
		if(p<=0 || p>1){
			alert("Probability should be in the range (0, 1].");
			return;
		}
		var d = [];
		var max = 500/p;
		d.push([-max, 0]);
		d.push([1, 0]);
		d.push(null);
		for (var i = 1; i < max; i++) {
			d.push([i, 1 - Math.pow((1-p), i)]);
			d.push([i+1, 1 - Math.pow((1-p), i)]);
			d.push(null);
		}

		var plot = $.plot("#placeholder", [{data: d, label: "Geometric distr CDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
			 	xaxis: {min: 0, max: 10/p},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function plotGeometricPMF(form) {
		var p = eval(form.p.value);
		if(p<=0 || p>1){
			alert("Probability should be in the range (0, 1].");
			return;
		}		
		var d1 = [];
		var d2 = [];
		var max = 500/p;
		for (var i = -max; i < 1; i++) {
			d1.push([i, 0]);
		}
		for (var i = 1; i < max; i++) {
			var val = p*Math.pow(1-p, i-1);
			d1.push([i, val]);
			d2.push([i, 0]);
			d2.push([i, val]);
			d2.push(null);
		}
		var plot = $.plot("#placeholder", 
			[{data: d1, label: "Geometric distr PMF", color: "#06A149", points: { show: true, fillColor: "#06A149"}},
			 {data: d2, color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
			 	xaxis: {min: 0, max: 10/p},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function plotPascalCDF(form) {
		var m = eval(form.m.value);
		var p = eval(form.p.value);
		if(m < 0){
			 alert("m should be non-negative.");
			 return;
		}
		if(p<=0 || p>1){
			alert("Probability should be in the range (0, 1].");
			return;
		}
		var d = [];
		var max = 500/p;
		d.push([-max+m, 0]);
		d.push([m, 0]);
		d.push(null);
		for (var i = m; i < max+m; i++) {
			var val = pascalCDF(m, p, i);
			d.push([i, val]);
			d.push([i+1, val]);
			d.push(null);
		}

		var plot = $.plot("#placeholder", [{data: d, label: "Pascal distr CDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
			 	xaxis: {min: m-2, max: 5*m/p},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function plotPascalPMF(form) {
		var m = eval(form.m.value);
		var p = eval(form.p.value);
		if(m < 0){
			 alert("m should be non-negative.");
			 return;
		}
		if(p<=0 || p>1){
			alert("Probability should be in the range (0, 1].");
			return;
		}		
		var d1 = [];
		var d2 = [];
		var max = 500/p;
		for (var i = -max+m; i < m; i++) {
			d1.push([i, 0]);
		}
		for (var i = m; i < max+m; i++) {
			var val = pascalPMF(m, p, i);
			d1.push([i, val]);
			d2.push([i, 0]);
			d2.push([i, val]);
			d2.push(null);
		}
		var plot = $.plot("#placeholder", 
			[{data: d1, label: "Pascal distr PMF", color: "#06A149", points: { show: true, fillColor: "#06A149"}},
			 {data: d2, color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
			 	xaxis: {min: m-2, max: 5*m/p},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function plotPoissonCDF(form) {
		var lam = eval(form.lam.value);
		if(lam <= 0){
			alert("Parameter lambda should be positive.");
			return;
		}
		var d = [];
		var max = 500 + 2*lam;
		d.push([-max, 0]);
		d.push([0, 0]);
		d.push(null);
		for (var i = 0; i < max; i++) {
			var val = poissonCDF(lam, i);
			d.push([i, val]);
			d.push([i+1, val]);
			d.push(null);
		}

		var plot = $.plot("#placeholder", [{data: d, label: "Poisson distr CDF", color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
			 	xaxis: {min: 0, max: 4*lam},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function plotPoissonPMF(form) {
		var lam = eval(form.lam.value);
		if(lam <= 0){
			alert("Parameter lambda should be positive.");
			return;
		}	
		var d1 = [];
		var d2 = [];
		var max = 500 + 2*lam;
		for (var i = -max; i < 0; i++) {
			d1.push([i, 0]);
		}
		for (var i = 0; i < max; i++) {
			var val = poissonPMF(lam, i);
			d1.push([i, val]);
			d2.push([i, 0]);
			d2.push([i, val]);
			d2.push(null);
		}
		var plot = $.plot("#placeholder", 
			[{data: d1, label: "Poisson distr PMF", color: "#06A149", points: { show: true, fillColor: "#06A149"}},
			 {data: d2, color: "#06A149"}],
			{
			 	zoom: {interactive: true},
				pan: {interactive: true},
			 	xaxis: {min: 0, max: 4*lam},
				yaxis: {min: 0}
			});
		zoomButtons(plot);
}

function zoomButtons(pt){
		var placeholder = $("#placeholder");
		
		$("<div class='button' style='right:20px;top:50px'><img src='//probabilitycourse.com/images/plus.png' width='35' height='35' alt='Zoom In' title='Zoom In'/></div>")
			.appendTo(placeholder)
			.click(function (event) {
				event.preventDefault();
				pt.zoom();
			});
		
		$("<div class='button' style='right:20px;top:100px'><img src='//probabilitycourse.com/images/minus.png' width='35' height='35' alt='Zoom Out' title='Zoom Out'/></div>")
			.appendTo(placeholder)
			.click(function (event) {
				event.preventDefault();
				pt.zoomOut();
			});		
}
