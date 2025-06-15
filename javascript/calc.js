
function calcPhi(form){
	var x = eval(form.x.value);
	var val = normalCDF(x, 0, 1);
	var phi = precise_round(val, 5);
	if(phi==0){
		if(x > -4.5) phi = precise_round(val, 7);
		else if(x > -5.5) phi = precise_round(val, 8);
		else phi = precise_round(val, 10);
		if(phi==0) form.phi.value = "0 < Phi < 10^(-10)";
		else form.phi.value = phi;
	} 
	else if(phi==1){
		 if(x < 4.5) phi = precise_round(val, 7);
		 else if(x < 5.5) phi = precise_round(val, 8);
		 else phi = precise_round(val, 10);
		 if(phi==1) form.phi.value = "1 - 10^(-10) < Phi < 1";
		 else form.phi.value = phi;
	} 
	else form.phi.value = phi;
}

function calcPhiInv(form){
	var x = eval(form.x.value);
	if(x<=0 || x>=1){
		 alert("The value of x should be in the range (0, 1).");
		 return;
	}
	form.phiInv.value = precise_round(phiInverse(x), 5);
}

// Phi inverse
// Lower tail quantile for standard normal distribution function.
// This function returns an approximation of the inverse cumulative
// standard normal distribution function.  I.e., given P, it returns
// an approximation to the X satisfying P = Pr{Z <= X} where Z is a
// random variable from the standard normal distribution.
// The algorithm uses a minimax approximation by rational functions
// and the result has a relative error whose absolute value is less
// than 1.15e-9.
// Author:      Peter John Acklam
// (Javascript version by Alankar Misra @ Digital Sutras (alankar@digitalsutras.com))
// Time-stamp:  2003-05-05 05:15:14
// E-mail:      pjacklam@online.no
// WWW URL:     http://home.online.no/~pjacklam
// An algorithm with a relative error less than 1.15*10-9 in the entire region.

function phiInverse(p){
	// Coefficients in rational approximations
    var a = new Array(-3.969683028665376e+01,  2.209460984245205e+02,
                      -2.759285104469687e+02,  1.383577518672690e+02,
                      -3.066479806614716e+01,  2.506628277459239e+00);

    var b = new Array(-5.447609879822406e+01,  1.615858368580409e+02,
                      -1.556989798598866e+02,  6.680131188771972e+01,
                      -1.328068155288572e+01 );

    var c = new Array(-7.784894002430293e-03, -3.223964580411365e-01,
                      -2.400758277161838e+00, -2.549732539343734e+00,
                      4.374664141464968e+00,  2.938163982698783e+00);

    var d = new Array (7.784695709041462e-03, 3.224671290700398e-01,
                       2.445134137142996e+00,  3.754408661907416e+00);

    // Define break-points.
    var plow  = 0.02425;
    var phigh = 1 - plow;	
	
    // Rational approximation for lower region:
    if ( p < plow ) {
             var q  = Math.sqrt(-2*Math.log(p));
             return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                                             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }

    // Rational approximation for upper region:
    if ( phigh < p ) {
             var q  = Math.sqrt(-2*Math.log(1-p));
             return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                                                    ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }

    // Rational approximation for central region:
    var q = p - 0.5;
    var r = q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
                             (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

function normalCDF(x, mu, sigma){
	var max = 10*sigma+mu;
    var min = -10*sigma+mu;
	if(x > max) return 1;

    else if(x > min){
      var z = (x-mu)/sigma;
      var sign = 1;
      if (z < 0){
		  z = -z;
		  sign = -1;
	  }
      var b0 = 0.2316419;
	  var b1 = 0.319381530;
	  var b2 = -0.356563782;
	  var b3 = 1.781477937;
	  var b4 = -1.821255978;
      var b5 = 1.330274429;
      var t=1/(1+b0*z);
      var phi=1-1/Math.sqrt(2*Math.PI)*Math.exp(-z*z/2)*(b1*t+b2*Math.pow(t,2)+b3*Math.pow(t,3)+b4*Math.pow(t,4)+b5*Math.pow(t,5));

      if(sign == 1)
        return phi;
      else
        return 1-phi;
    }
    else return 0;
}

function normalPDF(x, mu, sigma){
	var pdf = 1/Math.sqrt(2*Math.PI*sigma*sigma);
	pdf *= Math.exp(-(x-mu)*(x-mu)/(2*sigma*sigma));
	return pdf;
}

//using Box–Muller transform
function normalSample(mu, sigma){
	var rand1 = Math.random();
	var rand2 = Math.random();
	var standard = Math.sqrt(-2*Math.log(rand1))*Math.cos(2*Math.PI*rand2);
	return mu+standard*sigma;
}

function calcNormal(form){
	var mu = eval(form.m.value);
	var sig = eval(form.s.value);
	var x = eval(form.x.value);
	if(sig <= 0){
		 alert("The value of sigma should be greater than 0.");
		 return;
	}
	
	var cdf = precise_round(normalCDF(x, mu, sig), 5);
	if(cdf==0) form.cdf.value = "0 < CDF <0.00001";
	else if(cdf==1)form.cdf.value = "0.99999 < CDF < 1";
	else form.cdf.value = cdf;
	
	var pdf = precise_round(normalPDF(x, mu, sig), 5);
	if(pdf==0) form.pdf.value = "0 < PDF < 0.00001";
	else form.pdf.value = pdf;
	
	form.sam.value = precise_round(normalSample(mu, sig), 5);
}
 
function calcExp(form){
	var lam = eval(form.l.value);
	var x = eval(form.x.value);
	if(lam <= 0){
		alert("The value of lambda should be greater than 0.");
		return;
	}
	var max = 40/lam;
    var min = 0;
	
	if(x > max) form.cdf.value = ">0.99999";
	else if(x <= 0) form.cdf.value =  0;
	else{
		 var cdf = form.cdf.value = precise_round(1-Math.exp(-lam*x), 5);
		 if(cdf==0) form.cdf.value = "0 < CDF < 0.00001";
		 else if(cdf==1) form.cdf.value = "0.99999 < CDF < 1";
		 else form.cdf.value = cdf;
	}
	
	if(x < 0) form.pdf.value = 0;
	else if(x > max) form.pdf.value = "0 < PDF < 0.00001";
	else{
		 var pdf = precise_round(lam*Math.exp(-lam*x), 5);
		 if(pdf==0) form.pdf.value = "0 < PDF < 0.00001";
		 else form.pdf.value = pdf;
	}
	
	var expected = precise_round(1/lam, 5);
	if(expected==0) form.e.value = "0 < Ex < 0.00001";
	else form.e.value = expected;
	
	var variance = precise_round(1/(lam*lam), 5);
	if(variance==0) form.v.value = "0 < Var < 0.00001";
	else form.v.value = variance;
		
	var myrand = Math.random();
    form.sam.value = precise_round(-1/lam*Math.log(myrand), 5);
}
 
function calcBernoulli(form){
	var p = eval(form.p.value);
	var x = eval(form.x.value);
	
	if(p<0 || p>1){
		alert("Probability should be in the range [0, 1].");
		return;
	}

	if(x>=1)form.cdf.value = 1;
	else if(x>=0)form.cdf.value = 1-p;
	else form.cdf.value = 0;
	
	if(x==0) form.pmf.value = 1-p;
	else if(x==1) form.pmf.value = p;
	else form.pmf.value = 0;

	form.e.value = p;
	form.v.value = precise_round(p*(1-p), 10);
	
	var myrand = Math.random();
	if(myrand<p) form.sam.value = 1;
    else form.sam.value = 0;
}
 
function calcBinomial(form){
	var n = eval(form.n.value);
	var p = eval(form.p.value);
	var x = eval(form.x.value);
	if(n<=0){
		alert("n should be greater than 0.");
		return;
	}
	if(p<0 || p>1){
		alert("Probability should be in the range [0, 1].");
		return;
	}
	
	//can't perform the calculation
	if(n>200 && (n*p<=10 || n*(1-p)<=10)){
		 alert("Unfortunately we are unable to perform the calculation for given values of n and p.");
		 return;
	}	
	
	var cdf = precise_round(binomialCDF(p, n, x), 5);
	if(p>0 && 0<=x && x<n){
		 if(cdf==0) form.cdf.value = "0 < CDF < 0.00001";
		 else if(cdf==1) form.cdf.value = "0.99999 < CDF < 1";
		 else form.cdf.value = cdf;
	}
	else form.cdf.value = cdf;
	
	var pmf = precise_round(binomialPMF(p, n, x), 5);
	if(p>0 && 0<=x && x<=n && Math.round(x)==x){
		 if(pmf==0) form.pmf.value = "0 < PMF < 0.00001";
		 else if(pmf==1) form.pmf.value = "0.99999 < PMF < 1";
		 else form.pmf.value = pmf;
	}
	else form.pmf.value = pmf;
	
	var expected = n*p;
	var variance = n*p*(1 - p);
	form.e.value = precise_round(expected, 10);
	form.v.value = precise_round(variance, 10);
	
	var s = 0;
	for(var i = 0; i < n; i++){
  		var myrand = Math.random();
  		if(myrand<p) s++;
	}
	form.sam.value = s;
}

function binomialCDF(p, n, x){
	if(x >= n) return 1;
	if(x < 0) return 0;
	var cdf = 0;
	//use exact formula
	if(n <= 200){ 
		 for(var i = 0; i <= Math.floor(x); i++){
		 	cdf += binomialPMF(p, n, i);
		 }
	}
	//use approximation by Gaussian (normal) distribution
	else{
		 cdf = normalCDF(Math.floor(x)+0.5, n*p, Math.sqrt(n*p*(1-p)));
	}	
	return cdf;
}

function binomialPMF(p, n, k){
	if(k > n || k < 0) return 0;
	if(Math.round(k) != k) return 0; //k not an integer
	var pmf = 0;
	//use exact formula
	if(n <= 200){ 
		 pmf = binomialCoeff(n, k)*Math.pow(p, k)*Math.pow(1-p, n-k);
	}
	//use approximation by Gaussian (normal) distribution
	else{
		 pmf = normalPDF(k+0.5, n*p, Math.sqrt(n*p*(1-p)));
	}
	return pmf;
}

function calcBinomialCoefficient(form){
	var n = eval(form.n.value);
	var k = eval(form.k.value);
	
	if(n<0){
		alert("n should be greater than or equal to 0.");
		return;
	}
	if(k<0){
		alert("k should be greater than or equal to 0.");
		return;
	}
	if(n<k){
		alert("n should be greater than or equal to k.");
		return;
	}
	
	var co = binomialCoeff(n, k);
	form.coeff.value = Math.round(co);
}

function binomialCoeff(n, k){
	if(k==0) return 1;
	if(k==n) return 1;
	if(k > n/2) k = n-k;
	var coeff = 1;
    for (var i = n-k+1; i <= n; i++) coeff *= i;
    for (var i = 1;     i <= k; i++) coeff /= i;
    return coeff;	
}

function calcGeometric(form){	
	var p = eval(form.p.value);
	var x = eval(form.x.value);
	if(p<=0 || p>1){
		alert("Probability should be in the range (0, 1].");
		return;
	}
	
	if(x<1)form.cdf.value = 0;
	else{
		 var cdf = precise_round(1-Math.pow((1-p), Math.floor(x)), 5);
		 if(cdf==0) form.cdf.value = "0 < CDF < 0.00001";
		 else if(cdf==1) form.cdf.value = "0.99999 < CDF < 1";
		 else form.cdf.value = cdf;
	}
	
	// if x = 1, 2, 3...
	if($.isNumeric(x) && Math.floor(x) == x && x > 0){
		var pmf = precise_round(p*Math.pow(1-p, x-1), 5);
		if(pmf==0) form.pmf.value = "0 < PMF < 0.00001";
		else if(pmf==1) form.pmf.value = "0.99999 < PMF < 1";
		else form.pmf.value = pmf;
	}
	else form.pmf.value = 0;
	
	form.e.value = precise_round(1/p, 5);
	form.v.value = precise_round((1-p)/(p*p), 5);
	
	var heads = 0;
	var s = 0;
	while(heads != 1){
		myrand = Math.random();
  		if(myrand<p) heads = 1;
		s++;
	}
	form.sam.value = s;
}

function calcPascal(form){
	var m = eval(form.m.value);
	var p = eval(form.p.value);
	var x = eval(form.x.value);
	if(m < 0){
		alert("m should be non-negative.");
		return;
	}
	if(p<=0 || p>1){
		alert("Probability should be in the range (0, 1].");
		return;
	}
	
	var pmf = pascalPMF(m, p, x);
	if(Math.round(x)==x && x>=m){ //x is an integer greater than or equal to m 
		pmf = precise_round(pmf, 5);
		if(pmf==0) form.pmf.value = "0 < PMF < 0.00001";
		else if(pmf==1) form.pmf.value = "0.99999 < PMF < 1";
		else form.pmf.value = pmf;
	}
	else form.pmf.value = 0;
	
	var cdf = pascalCDF(m, p, x);
	if(x < m) form.cdf.value = 0;
	else{
		 cdf = precise_round(cdf, 5);
		 if(cdf==0) form.cdf.value = "0 < CDF < 0.00001";
		 else if(cdf==1) form.cdf.value = "0.99999 < CDF < 1";
		 else form.cdf.value = cdf;
	}
	
	form.e.value = precise_round(m/p, 5);
	form.v.value = precise_round(m*(1-p)/(p*p), 5);
	
	var heads = 0;
	var s = 0;
	while(heads < m){
		myrand = Math.random();
  		if(myrand<p) heads++;
		s++;
	}
	form.sam.value = s;
}

function pascalPMF(m, p, x){
	if(Math.round(x)!=x) return 0; //x is not an integer
	if(x < m) return 0;
	return(binomialCoeff(x-1, m-1)*Math.pow(p, m)*Math.pow(1-p, x-m));	
}

function pascalCDF(m, p, x){
	var cdf = 0;
	for(var i = m; i <= Math.floor(x); i++){
		 	cdf += pascalPMF(m, p, i);
	}
	return cdf;
}

function calcPoisson(form){
	var lam = eval(form.lam.value);
	var x = eval(form.x.value);
	if(lam <= 0){
		alert("Parameter lambda should be positive.");
		return;
	}
	
	var pmf = poissonPMF(lam, x);
	if(Math.round(x)==x && x>=0){ //x is an integer greater than or equal to 0 
		pmf = precise_round(pmf, 5);
		if(pmf==0) form.pmf.value = "0 < PMF < 0.00001";
		else if(pmf==1) form.pmf.value = "0.99999 < PMF < 1";
		else form.pmf.value = pmf;
	}
	else form.pmf.value = 0;
	
	var cdf = poissonCDF(lam, x);
	if(x < 0) form.cdf.value = 0;
	else{
		 cdf = precise_round(cdf, 5);
		 if(cdf==0) form.cdf.value = "0 < CDF < 0.00001";
		 else if(cdf==1) form.cdf.value = "0.99999 < CDF < 1";
		 else form.cdf.value = cdf;
	}
	
	form.e.value = lam;
	form.v.value = lam;
	
	form.sam.value = poissonSample(lam);
}

function poissonPMF(lam, x){
	if(Math.round(x)!=x) return 0; //x is not an integer
	if(x < 0) return 0;
	var factorial = 1;
	for(var i = 2; i <= x; i++){
		factorial *= i;
	}
	return (Math.pow(Math.E,-lam)*Math.pow(lam,x)/factorial);
}

function poissonCDF(lam, x){
	var cdf = 0;
	for(var i = 0; i <= Math.floor(x); i++){
		 cdf += poissonPMF(lam, i);
	}
	return cdf;
}

function poissonSample(lam){
	var l = Math.exp(-lam);
  	var p = 1.0;
  	var k = 0;

  	do {
       k++;
       p *= Math.random();
  	} while (p > l);

  	return k - 1;
}

function precise_round(num, decimals){
	return Math.round(num*Math.pow(10,decimals))/Math.pow(10,decimals);
}